// New file: src/endpoints/supportTicketEndpoints.ts
import type { PayloadRequest } from 'payload'
import { sendSupportTicketNotification } from '../services/notifications/adminNotifications'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.body && typeof req.body === 'object') {
      return req.body
    }
    
    const text = await req.text?.() || ''
    return JSON.parse(text)
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// ===== DRIVER & ADVERTISER SUPPORT ENDPOINTS =====

// Submit a support ticket (driver or advertiser)
export const submitSupportTicket = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { category, subject, description, priority, attachments } = body

    if (!category || !subject || !description) {
      return new Response(JSON.stringify({
        error: 'Category, subject, and description are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🎫 User ${user.id} submitting support ticket: ${subject}`)

    // Create support ticket
    const ticket = await req.payload.create({
      collection: 'support-tickets',
      data: {
        submittedBy: user.id,
        userRole: user.role === 'partner' ? 'advertiser' : user.role === 'admin' ? 'admin' : 'driver',
        category,
        subject,
        description,
        priority: priority || 'medium',
        status: 'open',
        attachments: attachments || [],
        tags: []
      }
    })

    // Send notification to admin about new support ticket
    try {
      await sendSupportTicketNotification(
        req.payload,
        (ticket as any).id,
        (ticket as any).ticketNumber || (ticket as any).id,
        user!.id,
        user!.email,
        subject
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send new ticket notification to admin:', notifError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Support ticket submitted successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: (ticket as any).ticketNumber,
        subject: (ticket as any).subject,
        status: (ticket as any).status,
        priority: (ticket as any).priority,
        createdAt: (ticket as any).createdAt
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Submit support ticket error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit support ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get user's own support tickets
export const getUserSupportTickets = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const statusFilter = searchParams.get('status') || ''
    const categoryFilter = searchParams.get('category') || ''

    console.log(`🎫 User ${user.id} fetching support tickets`)

    const whereClause: any = {
      submittedBy: { equals: user.id }
    }

    if (statusFilter) {
      whereClause.status = { equals: statusFilter }
    }

    if (categoryFilter) {
      whereClause.category = { equals: categoryFilter }
    }

    const tickets = await req.payload.find({
      collection: 'support-tickets',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit,
      depth: 1
    })

    return new Response(JSON.stringify({
      success: true,
      ...tickets,
      docs: tickets.docs.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        // Filter out internal notes from responses
        responses: ticket.responses?.filter((r: any) => !r.isInternal).map((r: any) => ({
          responseText: r.responseText,
          respondedAt: r.respondedAt
        })) || []
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get support tickets error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get support tickets',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get single ticket details
export const getSupportTicketDetails = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const ticketId = pathParts[pathParts.length - 1]

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'Ticket ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎫 User ${user.id} fetching ticket details: ${ticketId}`)

    const ticket = await req.payload.findByID({
      collection: 'support-tickets',
      id: ticketId,
      depth: 2
    })

    if (!ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify ownership (non-admins can only see their own tickets)
    if (user.role !== 'admin' && (ticket as any).submittedBy !== user.id && (ticket as any).submittedBy?.id !== user.id) {
      return new Response(JSON.stringify({
        error: 'Access denied - You can only view your own tickets'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Filter internal notes if not admin
    const responses = user.role === 'admin' 
      ? (ticket as any).responses 
      : (ticket as any).responses?.filter((r: any) => !r.isInternal)

    return new Response(JSON.stringify({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: (ticket as any).ticketNumber,
        category: (ticket as any).category,
        subject: (ticket as any).subject,
        description: (ticket as any).description,
        status: (ticket as any).status,
        priority: (ticket as any).priority,
        attachments: (ticket as any).attachments,
        createdAt: (ticket as any).createdAt,
        resolvedAt: (ticket as any).resolvedAt,
        resolutionNotes: (ticket as any).resolutionNotes,
        responses: responses || []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get ticket details error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get ticket details',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Add response to ticket (user adding more info)
export const addTicketResponse = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const ticketId = pathParts[pathParts.length - 2] // /tickets/:id/respond

    const body = await parseRequestBody(req)
    const { responseText } = body

    if (!ticketId || !responseText) {
      return new Response(JSON.stringify({ error: 'Ticket ID and response text are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎫 User ${user.id} adding response to ticket: ${ticketId}`)

    const ticket = await req.payload.findByID({
      collection: 'support-tickets',
      id: ticketId
    })

    if (!ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify ownership
    if (user.role !== 'admin' && (ticket as any).submittedBy !== user.id && (ticket as any).submittedBy?.id !== user.id) {
      return new Response(JSON.stringify({
        error: 'Access denied - You can only respond to your own tickets'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Add response
    const existingResponses = (ticket as any).responses || []
    const updatedTicket = await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: {
        responses: [
          ...existingResponses,
          {
            respondedBy: user.id,
            responseText,
            isInternal: false,
            respondedAt: new Date().toISOString()
          }
        ],
        status: 'waiting_user' // User has responded
      }
    })

    // TODO: Notify assigned admin about new response
    console.log(`📧 TODO: Notify admin about new response on ticket ${(ticket as any).ticketNumber}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Response added successfully',
      ticket: {
        id: updatedTicket.id,
        status: (updatedTicket as any).status
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Add ticket response error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add response',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


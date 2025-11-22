// New file: src/endpoints/adminSupportEndpoints.ts
import type { PayloadRequest } from 'payload'
import { checkAdminAccess, parseRequestBody } from '../utilities/requestHelpers'
import { sendSupportNotification } from '../services/notifications/advertiserNotifications'
import { sendDriverNotification } from '../services/notifications/driverNotifications'

// Get all support tickets (admin view)
export const getAllSupportTickets = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const statusFilter = searchParams.get('status') || ''
    const priorityFilter = searchParams.get('priority') || ''
    const categoryFilter = searchParams.get('category') || ''
    const userRoleFilter = searchParams.get('userRole') || ''
    const search = searchParams.get('search') || ''

    console.log(`🎫 Admin fetching support tickets`)

    const whereClause: any = {}

    if (statusFilter) {
      whereClause.status = { equals: statusFilter }
    }

    if (priorityFilter) {
      whereClause.priority = { equals: priorityFilter }
    }

    if (categoryFilter) {
      whereClause.category = { equals: categoryFilter }
    }

    if (userRoleFilter) {
      whereClause.userRole = { equals: userRoleFilter }
    }

    if (search) {
      whereClause.or = [
        { ticketNumber: { contains: search } },
        { subject: { contains: search } },
        { description: { contains: search } }
      ]
    }

    const tickets = await req.payload.find({
      collection: 'support-tickets',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit,
      depth: 2
    })

    return new Response(JSON.stringify({
      success: true,
      ...tickets,
      docs: tickets.docs.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        category: ticket.category,
        userRole: ticket.userRole,
        submittedBy: {
          id: ticket.submittedBy?.id,
          name: `${ticket.submittedBy?.firstName || ''} ${ticket.submittedBy?.lastName || ''}`.trim(),
          email: ticket.submittedBy?.email
        },
        status: ticket.status,
        priority: ticket.priority,
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo.id,
          email: ticket.assignedTo.email
        } : null,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        responsesCount: ticket.responses?.length || 0
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get all support tickets error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get support tickets',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get ticket statistics
export const getSupportTicketStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Admin fetching support ticket statistics')

    const allTickets = await req.payload.find({
      collection: 'support-tickets',
      limit: 0
    })

    const stats = {
      total: allTickets.totalDocs,
      byStatus: {
        open: allTickets.docs.filter((t: any) => t.status === 'open').length,
        in_progress: allTickets.docs.filter((t: any) => t.status === 'in_progress').length,
        waiting_user: allTickets.docs.filter((t: any) => t.status === 'waiting_user').length,
        resolved: allTickets.docs.filter((t: any) => t.status === 'resolved').length,
        closed: allTickets.docs.filter((t: any) => t.status === 'closed').length
      },
      byPriority: {
        low: allTickets.docs.filter((t: any) => t.priority === 'low').length,
        medium: allTickets.docs.filter((t: any) => t.priority === 'medium').length,
        high: allTickets.docs.filter((t: any) => t.priority === 'high').length,
        urgent: allTickets.docs.filter((t: any) => t.priority === 'urgent').length
      },
      byUserRole: {
        driver: allTickets.docs.filter((t: any) => t.userRole === 'driver').length,
        advertiser: allTickets.docs.filter((t: any) => t.userRole === 'advertiser').length,
        admin: allTickets.docs.filter((t: any) => t.userRole === 'admin').length
      },
      byCategory: {} as any
    }

    // Count by category
    allTickets.docs.forEach((ticket: any) => {
      const category = ticket.category || 'other'
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
    })

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get support ticket stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get ticket statistics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Assign ticket to admin
export const assignTicket = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { ticketId, adminId } = body

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'Ticket ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎫 Admin ${user.id} assigning ticket ${ticketId} to ${adminId || 'self'}`)

    const assignTo = adminId || user.id

    const updatedTicket = await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: {
        assignedTo: assignTo,
        status: 'in_progress'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket assigned successfully',
      ticket: {
        id: updatedTicket.id,
        assignedTo: (updatedTicket as any).assignedTo,
        status: (updatedTicket as any).status
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Assign ticket error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to assign ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Add admin response to ticket
export const addAdminResponse = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const ticketId = pathParts[pathParts.length - 2] // /admin/support/:id/respond

    const { responseText, isInternal } = body

    if (!ticketId || !responseText) {
      return new Response(JSON.stringify({ error: 'Ticket ID and response text are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎫 Admin ${user.id} responding to ticket: ${ticketId}`)

    const ticket = await req.payload.findByID({
      collection: 'support-tickets',
      id: ticketId
    })

    if (!ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

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
            isInternal: isInternal || false,
            respondedAt: new Date().toISOString()
          }
        ],
        status: isInternal ? (ticket as any).status : 'waiting_user'
      }
    })

    // Send notification to ticket submitter if not internal
    if (!isInternal) {
      const submitterId = typeof (ticket as any).submittedBy === 'object' 
        ? (ticket as any).submittedBy.id 
        : (ticket as any).submittedBy
      
      if (submitterId) {
        try {
          // Get submitter to determine if driver or advertiser
          const submitter = await req.payload.findByID({ collection: 'users', id: submitterId })
          
          if (submitter.role === 'driver') {
            // Send driver notification
            await sendDriverNotification(req.payload, {
              driverId: submitterId,
              type: 'system',
              title: 'New Support Response',
              message: `Admin has responded to your support ticket #${(ticket as any).ticketNumber}`,
              priority: 'medium',
              actionUrl: `/driver/support/${ticketId}`
            })
          } else {
            // Send advertiser notification - find business details
            const businesses = await req.payload.find({
              collection: 'business-details',
              where: { userId: { equals: submitterId } },
              limit: 1
            })
            
            if (businesses.docs.length > 0) {
              await sendSupportNotification(
                req.payload,
                businesses.docs[0].id,
                'response',
                ticketId,
                (ticket as any).ticketNumber || ticketId,
                responseText
              )
            }
          }
        } catch (notifError) {
          console.warn('⚠️ Failed to send support response notification:', notifError)
        }
      }
    }

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
    console.error('❌ Add admin response error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add response',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Resolve ticket
export const resolveTicket = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { ticketId, resolutionNotes } = body

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'Ticket ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`✅ Admin ${user.id} resolving ticket: ${ticketId}`)

    const updatedTicket = await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.id,
        resolutionNotes: resolutionNotes || ''
      }
    })

    // Send resolution notification to ticket submitter
    const ticket = await req.payload.findByID({ collection: 'support-tickets', id: ticketId })
    const submitterId = typeof (ticket as any).submittedBy === 'object' 
      ? (ticket as any).submittedBy.id 
      : (ticket as any).submittedBy
    
    if (submitterId) {
      try {
        // Get submitter to determine if driver or advertiser
        const submitter = await req.payload.findByID({ collection: 'users', id: submitterId })
        
        if (submitter.role === 'driver') {
          // Send driver notification
          await sendDriverNotification(req.payload, {
            driverId: submitterId,
            type: 'system',
            title: 'Support Ticket Resolved',
            message: `Your support ticket #${(ticket as any).ticketNumber} has been resolved. ${resolutionNotes || ''}`,
            priority: 'medium',
            actionUrl: `/driver/support/${ticketId}`
          })
        } else {
          // Send advertiser notification - find business details
          const businesses = await req.payload.find({
            collection: 'business-details',
            where: { userId: { equals: submitterId } },
            limit: 1
          })
          
          if (businesses.docs.length > 0) {
            await sendSupportNotification(
              req.payload,
              businesses.docs[0].id,
              'resolved',
              ticketId,
              (ticket as any).ticketNumber || ticketId,
              resolutionNotes
            )
          }
        }
      } catch (notifError) {
        console.warn('⚠️ Failed to send ticket resolution notification:', notifError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket resolved successfully',
      ticket: {
        id: updatedTicket.id,
        status: (updatedTicket as any).status,
        resolvedAt: (updatedTicket as any).resolvedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Resolve ticket error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to resolve ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update ticket status
export const updateTicketStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { ticketId, status, priority } = body

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'Ticket ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎫 Admin ${user.id} updating ticket ${ticketId}: status=${status}, priority=${priority}`)

    const updateData: any = {}
    if (status) updateData.status = status
    if (priority) updateData.priority = priority

    const updatedTicket = await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: updateData
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket updated successfully',
      ticket: {
        id: updatedTicket.id,
        status: (updatedTicket as any).status,
        priority: (updatedTicket as any).priority
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Update ticket status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


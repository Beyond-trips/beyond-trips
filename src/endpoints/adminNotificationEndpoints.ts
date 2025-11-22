// endpoints/adminNotificationEndpoints.ts

import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return req.body
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// Helper function to check admin access
const checkAdminAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (user.role !== 'admin') {
    return new Response(JSON.stringify({
      error: 'Access denied - Admin privileges required'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// ===== NOTIFICATION BROADCASTING =====

// Send notification to users
export const sendNotification = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const {
      userSegment, // drivers, advertisers, all, specific
      userId, // for specific
      title,
      message,
      type, // payment, campaign, magazine, system
      priority, // low, medium, high
      scheduleFor
    } = body

    if (!title || !message || !type) {
      return new Response(JSON.stringify({
        error: 'Title, message, and type are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📢 Broadcasting notification to segment:', userSegment || 'drivers')

    let recipients: any[] = []

    // Determine recipients based on recipientType
    const segment = userSegment || 'drivers'
    if (segment === 'drivers') {
      const drivers = await req.payload.find({
        collection: 'users',
        where: { role: { equals: 'user' } },
        limit: 1000
      })
      recipients = drivers.docs
    } else if (segment === 'advertisers' || segment === 'all') {
      const advertisers = await req.payload.find({
        collection: 'business-details',
        limit: 1000
      })
      // Get users associated with advertisers
      for (const business of advertisers.docs) {
        const users = await req.payload.find({
          collection: 'users',
          where: { email: { equals: (business as any).companyEmail } },
          limit: 1
        })
        recipients.push(...users.docs)
      }
    } else if (segment === 'specific' && userId) {
      try {
        const specificUser = await req.payload.findByID({
          collection: 'users',
          id: userId
        })
        if (specificUser) {
          recipients = [specificUser]
        }
      } catch (e) {
        console.error('❌ Failed to find specific user by ID:', userId, e)
      }
    }

    // If no recipients, still return success with zero sent, per tests expectation

    // Create notifications for all recipients
    let successCount = 0
    let failureCount = 0

    for (const recipient of recipients) {
      try {
        await req.payload.create({
          collection: 'driver-notifications',
          data: {
            driver: recipient.id,
            type: type || 'system',
            title,
            message,
            isRead: false,
            priority: priority || 'normal'
          }
        })
        successCount++
      } catch (error) {
        console.error('❌ Failed to send notification to:', recipient.id, error)
        failureCount++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      result: {
        notificationsSent: successCount,
        totalRecipients: recipients.length,
        failed: failureCount
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Send notification error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to send notification'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== NOTIFICATION TEMPLATES =====

// Get all templates
export const getAllTemplates = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const type = searchParams.get('type') || ''

    console.log('📝 Getting notification templates, type:', type)

    const whereClause: any = {}
    if (type) {
      whereClause.type = { equals: type }
    }

    const templates = await req.payload.find({
      collection: 'notification-templates',
      where: whereClause,
      sort: 'name',
      limit: 100
    })

    return new Response(JSON.stringify({
      success: true,
      templates: templates.docs.map((template: any) => ({
        id: template.id,
        name: template.name,
        type: template.type,
        subject: template.subject,
        body: template.body,
        lastUpdatedBy: template.lastUpdatedBy,
        lastUpdatedAt: template.lastUpdatedAt,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      })),
      total: templates.totalDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get templates error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get templates'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Create template
export const createTemplate = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { name, type, subject, body: bodyContent } = body

    if (!name || !type || (type === 'email' && !subject) || !bodyContent) {
      return new Response(JSON.stringify({
        error: 'Name, type, and body are required (subject required for email)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📝 Creating notification template:', name)

    // Create template
    const newTemplate = await req.payload.create({
      collection: 'notification-templates',
      data: {
        name,
        code: name.toUpperCase().replace(/\s+/g, '_'),
        type,
        subject: subject || name,
        body: bodyContent,
        channels: ['in_app'],
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Template created successfully',
      template: {
        id: (newTemplate as any).id,
        name: (newTemplate as any).name,
        type: (newTemplate as any).type
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create template error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create template'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update template
export const updateTemplate = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { templateId, name, subject, body: bodyContent, isActive } = body

    if (!templateId) {
      return new Response(JSON.stringify({
        error: 'Template ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📝 Updating template:', templateId)

    // Build update data
    const updateData: any = {
      lastUpdatedBy: user!.id,
      lastUpdatedAt: new Date().toISOString(),
    }

    if (name) updateData.name = name
    if (subject) updateData.subject = subject
    if (bodyContent) updateData.body = bodyContent
    if (isActive !== undefined) updateData.isActive = isActive

    // Update template
    let updatedTemplate: any = null
    try {
      updatedTemplate = await req.payload.update({
        collection: 'notification-templates',
        id: templateId,
        data: updateData
      })
    } catch (e) {
      updatedTemplate = null
    }

    if (!updatedTemplate) {
      return new Response(JSON.stringify({
        error: 'Template not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Template updated successfully',
      template: {
        id: (updatedTemplate as any).id,
        name: (updatedTemplate as any).name,
        type: (updatedTemplate as any).type
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update template error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update template'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete template
export const deleteTemplate = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { templateId } = body

    if (!templateId) {
      return new Response(JSON.stringify({
        error: 'Template ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📝 Deleting template:', templateId)

    // Delete template
    try {
      await req.payload.delete({
        collection: 'notification-templates',
        id: templateId
      })
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Template not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Template deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete template error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete template'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


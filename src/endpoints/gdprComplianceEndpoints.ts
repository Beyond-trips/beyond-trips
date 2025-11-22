// New file: src/endpoints/gdprComplianceEndpoints.ts
import type { PayloadRequest } from 'payload'
import { sendGDPRRequestNotification } from '../services/notifications/adminNotifications'

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

// ===== GDPR COMPLIANCE ENDPOINTS =====

// Export personal data
export const exportPersonalData = async (req: PayloadRequest): Promise<Response> => {
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

    console.log(`📥 User ${user.id} requesting personal data export`)

    // Collect all user data from various collections
    const userData: any = {
      exportedAt: new Date().toISOString(),
      userId: user.id,
      personalInfo: {
        email: user.email,
        firstName: (user as any).firstName,
        lastName: (user as any).lastName,
        phoneNumber: (user as any).phoneNumber,
        role: user.role,
        status: (user as any).status,
        createdAt: (user as any).createdAt
      }
    }

    // Get onboarding data
    const onboarding = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: user.id } },
      limit: 1
    })
    if (onboarding.docs.length > 0) {
      userData.onboarding = onboarding.docs[0]
    }

    // Get documents
    const documents = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: user.id } }
    })
    userData.documents = documents.docs

    // Get bank details
    const bankDetails = await req.payload.find({
      collection: 'user-bank-details',
      where: { userId: { equals: user.id } }
    })
    userData.bankDetails = bankDetails.docs

    // For drivers: get earnings, withdrawals, ratings, scans
    if (user.role === 'user' || user.role === 'driver') {
      const earnings = await req.payload.find({
        collection: 'driver-earnings',
        where: { driver: { equals: user.id } }
      })
      userData.earnings = earnings.docs

      const withdrawals = await req.payload.find({
        collection: 'driver-withdrawals',
        where: { driver: { equals: user.id } }
      })
      userData.withdrawals = withdrawals.docs

      const ratings = await req.payload.find({
        collection: 'driver-ratings',
        where: { driver: { equals: user.id } }
      })
      userData.ratings = ratings.docs

      const scans = await req.payload.find({
        collection: 'driver-scans',
        where: { driver: { equals: user.id } }
      })
      userData.scans = scans.docs

      const magazinePickups = await req.payload.find({
        collection: 'magazine-pickups',
        where: { driver: { equals: user.id } }
      })
      userData.magazinePickups = magazinePickups.docs

      const notifications = await req.payload.find({
        collection: 'driver-notifications',
        where: { driver: { equals: user.id } }
      })
      userData.notifications = notifications.docs
    }

    // For advertisers: get business details, campaigns, invoices
    if (user.role === 'partner' || user.role === 'advertiser') {
      const businessDetails = await req.payload.find({
        collection: 'business-details',
        where: {
          or: [
            { userId: { equals: user.id } },
            { businessEmail: { equals: user.email } }
          ]
        }
      })
      userData.businessDetails = businessDetails.docs

      if (businessDetails.docs.length > 0) {
        const businessId = businessDetails.docs[0].id
        
        const campaigns = await req.payload.find({
          collection: 'ad-campaigns',
          where: { businessId: { equals: businessId } }
        })
        userData.campaigns = campaigns.docs

        const invoices = await req.payload.find({
          collection: 'invoices',
          where: { businessId: { equals: businessId } }
        })
        userData.invoices = invoices.docs
      }
    }

    // Get support tickets
    const supportTickets = await req.payload.find({
      collection: 'support-tickets',
      where: { submittedBy: { equals: user.id } }
    })
    userData.supportTickets = supportTickets.docs

    // Return as JSON (can be converted to PDF/CSV on frontend)
    return new Response(JSON.stringify({
      success: true,
      message: 'Personal data exported successfully',
      data: userData
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="personal_data_${user.id}_${Date.now()}.json"`
      }
    })

  } catch (error: any) {
    console.error('❌ Export personal data error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export personal data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Request data deletion
export const requestDataDeletion = async (req: PayloadRequest): Promise<Response> => {
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
    const { reason, confirmEmail } = body

    if (!confirmEmail || confirmEmail !== user.email) {
      return new Response(JSON.stringify({
        error: 'Email confirmation does not match your account email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🗑️ User ${user.id} requesting data deletion`)

    // Create a deletion request record (for admin review)
    // In a real implementation, you'd have a DataDeletionRequests collection
    // For now, we'll create a support ticket
    const deletionTicket = await req.payload.create({
      collection: 'support-tickets',
      data: {
        submittedBy: user.id,
        userRole: user.role === 'partner' ? 'advertiser' : user.role === 'admin' ? 'admin' : 'driver',
        category: 'account',
        subject: 'Data Deletion Request (GDPR)',
        description: `User has requested complete data deletion under GDPR.\n\nReason: ${reason || 'Not provided'}\n\nEmail confirmed: ${confirmEmail}`,
        priority: 'high',
        status: 'open',
        tags: [{ tag: 'gdpr' }, { tag: 'data-deletion' }]
      }
    })

    // Mark user account for deletion (add a flag)
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        status: 'pending_deletion' as any, // This may need type update
        // Store deletion request timestamp in a custom field if available
      }
    })

    // Send notification to admin about deletion request
    try {
      await sendGDPRRequestNotification(
        req.payload,
        user.id,
        user.email,
        'deletion'
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send GDPR deletion notification to admin:', notifError)
    }

    // TODO: Send confirmation email to user
    console.log(`📧 TODO: Send deletion request confirmation email to ${user.email}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Data deletion request submitted successfully. Our team will process your request within 30 days as required by GDPR.',
      ticketNumber: (deletionTicket as any).ticketNumber,
      notice: 'Your account has been marked for deletion. You will receive a confirmation email once the process is complete.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Request data deletion error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to request data deletion',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Admin: Get all deletion requests
export const getDataDeletionRequests = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🗑️ Admin fetching data deletion requests')

    // Find all tickets tagged with 'data-deletion'
    const deletionRequests = await req.payload.find({
      collection: 'support-tickets',
      where: {
        and: [
          { category: { equals: 'account' } },
          { subject: { contains: 'Data Deletion Request' } }
        ]
      },
      sort: '-createdAt',
      depth: 1
    })

    return new Response(JSON.stringify({
      success: true,
      ...deletionRequests,
      docs: deletionRequests.docs.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        userId: ticket.submittedBy?.id,
        userEmail: ticket.submittedBy?.email,
        userName: `${ticket.submittedBy?.firstName || ''} ${ticket.submittedBy?.lastName || ''}`.trim(),
        userRole: ticket.userRole,
        requestedAt: ticket.createdAt,
        status: ticket.status
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get deletion requests error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get deletion requests',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Admin: Process data deletion
export const processDataDeletion = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { userId, ticketId } = body

    if (!userId || !ticketId) {
      return new Response(JSON.stringify({
        error: 'User ID and ticket ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🗑️ Admin ${user.id} processing data deletion for user ${userId}`)

    // This is a critical operation - in production, this should:
    // 1. Create a backup of all user data
    // 2. Anonymize rather than delete where legally required
    // 3. Keep audit logs
    // 4. Send confirmation emails

    // For now, we'll just mark the ticket as resolved and update user status
    await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.id,
        resolutionNotes: 'Data deletion processed by admin'
      }
    })

    await req.payload.update({
      collection: 'users',
      id: userId,
      data: {
        status: 'deleted' as any,
        // In production, anonymize sensitive fields
        email: `deleted_${userId}@anonymized.local`,
        firstName: 'Deleted',
        lastName: 'User'
      }
    })

    // TODO: Actually delete/anonymize all related data
    console.log(`⚠️ TODO: Implement full data deletion/anonymization for user ${userId}`)
    console.log(`📧 TODO: Send deletion confirmation email`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Data deletion processed successfully',
      warning: 'Please ensure all user data has been properly deleted or anonymized per GDPR requirements'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Process data deletion error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process data deletion',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


// New file: src/endpoints/adminCreativeApprovalEndpoints.ts
import type { PayloadRequest } from 'payload'
import { checkAdminAccess, parseRequestBody } from '../utilities/requestHelpers'
import { sendCreativeNotification } from '../services/notifications/advertiserNotifications'

// Get all pending creatives for approval
export const getPendingCreatives = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const statusFilter = searchParams.get('approvalStatus') || 'pending'
    const search = searchParams.get('search') || ''

    console.log(`🎨 Admin fetching campaign creatives with status: ${statusFilter}`)

    const whereClause: any = {
      approvalStatus: { equals: statusFilter }
    }

    if (search) {
      // Search by filename
      whereClause.fileName = { contains: search }
    }

    const creatives = await req.payload.find({
      collection: 'campaign-media',
      where: whereClause,
      sort: '-uploadedAt',
      page,
      limit,
      depth: 2 // Populate campaign and business details
    })

    return new Response(JSON.stringify({
      success: true,
      ...creatives,
      docs: creatives.docs.map((creative: any) => ({
        id: creative.id,
        fileName: creative.fileName,
        fileType: creative.fileType,
        fileUrl: creative.fileUrl,
        fileSize: creative.fileSize,
        description: creative.description,
        approvalStatus: creative.approvalStatus,
        uploadStatus: creative.uploadStatus,
        uploadedAt: creative.uploadedAt,
        approvedAt: creative.approvedAt,
        rejectionReason: creative.rejectionReason,
        adminNotes: creative.adminNotes,
        campaign: {
          id: creative.campaignId?.id,
          name: creative.campaignId?.campaignName,
          status: creative.campaignId?.status
        },
        business: {
          id: creative.businessId?.id,
          name: creative.businessId?.businessName,
          email: creative.businessId?.businessEmail
        }
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get pending creatives error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get pending creatives',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get creative details by ID
export const getCreativeDetails = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    if (!req.url) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const creativeId = pathParts[pathParts.length - 1]

    if (!creativeId) {
      return new Response(JSON.stringify({ error: 'Creative ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🎨 Admin fetching creative details for ID: ${creativeId}`)

    const creative = await req.payload.findByID({
      collection: 'campaign-media',
      id: creativeId,
      depth: 2 // Populate campaign and business details
    })

    if (!creative) {
      return new Response(JSON.stringify({ error: 'Creative not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      creative: {
        id: creative.id,
        fileName: (creative as any).fileName,
        fileType: (creative as any).fileType,
        fileUrl: (creative as any).fileUrl,
        fileSize: (creative as any).fileSize,
        description: (creative as any).description,
        approvalStatus: (creative as any).approvalStatus,
        uploadStatus: (creative as any).uploadStatus,
        uploadedAt: (creative as any).uploadedAt,
        approvedAt: (creative as any).approvedAt,
        approvedBy: (creative as any).approvedBy?.email,
        rejectionReason: (creative as any).rejectionReason,
        adminNotes: (creative as any).adminNotes,
        campaign: {
          id: (creative as any).campaignId?.id,
          name: (creative as any).campaignId?.campaignName,
          status: (creative as any).campaignId?.status,
          type: (creative as any).campaignId?.campaignType
        },
        business: {
          id: (creative as any).businessId?.id,
          name: (creative as any).businessId?.businessName,
          email: (creative as any).businessId?.businessEmail
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get creative details error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get creative details',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Approve a creative
export const approveCreative = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    if (!req.url) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const creativeId = pathParts[pathParts.length - 2] // /admin/creatives/:id/approve

    const body = await parseRequestBody(req)
    const { adminNotes } = body

    if (!creativeId) {
      return new Response(JSON.stringify({ error: 'Creative ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`✅ Admin approving creative: ${creativeId}`)

    // Add type guard to ensure user is not null
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updatedCreative = await req.payload.update({
      collection: 'campaign-media',
      id: creativeId,
      data: {
        approvalStatus: 'approved',
        isApproved: true, // Sync legacy field
        approvedAt: new Date().toISOString(),
        approvedBy: user.id,
        rejectionReason: null, // Clear any previous rejection reason
        adminNotes: adminNotes || null
      } as any
    })

    if (!updatedCreative) {
      return new Response(JSON.stringify({ error: 'Creative not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Send notification to advertiser about creative approval
    const campaignId = typeof (updatedCreative as any).campaignId === 'object' 
      ? (updatedCreative as any).campaignId.id 
      : (updatedCreative as any).campaignId
    
    if (campaignId) {
      try {
        const campaign = await req.payload.findByID({ collection: 'ad-campaigns', id: campaignId })
        const businessId = typeof (campaign as any).businessId === 'object' 
          ? (campaign as any).businessId.id 
          : (campaign as any).businessId
        
        if (businessId) {
          await sendCreativeNotification(
            req.payload,
            businessId,
            'approved',
            updatedCreative.id,
            (updatedCreative as any).fileName || 'Creative'
          )
        }
      } catch (notifError) {
        console.warn('⚠️ Failed to send creative approval notification:', notifError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Creative approved successfully',
      creative: {
        id: updatedCreative.id,
        approvalStatus: (updatedCreative as any).approvalStatus,
        approvedAt: (updatedCreative as any).approvedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Approve creative error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve creative',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Reject a creative
export const rejectCreative = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    if (!req.url) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const creativeId = pathParts[pathParts.length - 2] // /admin/creatives/:id/reject

    const body = await parseRequestBody(req)
    const { reason, adminNotes } = body

    if (!creativeId || !reason) {
      return new Response(JSON.stringify({ error: 'Creative ID and rejection reason are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`❌ Admin rejecting creative: ${creativeId} with reason: ${reason}`)

    const updatedCreative = await req.payload.update({
      collection: 'campaign-media',
      id: creativeId,
      data: {
        approvalStatus: 'rejected',
        isApproved: false, // Sync legacy field
        rejectionReason: reason,
        approvedAt: null, // Clear approval info
        approvedBy: null,
        adminNotes: adminNotes || null
      } as any
    })

    if (!updatedCreative) {
      return new Response(JSON.stringify({ error: 'Creative not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Send notification to advertiser about creative rejection
    const campaignId = typeof (updatedCreative as any).campaignId === 'object' 
      ? (updatedCreative as any).campaignId.id 
      : (updatedCreative as any).campaignId
    
    if (campaignId) {
      try {
        const campaign = await req.payload.findByID({ collection: 'ad-campaigns', id: campaignId })
        const businessId = typeof (campaign as any).businessId === 'object' 
          ? (campaign as any).businessId.id 
          : (campaign as any).businessId
        
        if (businessId) {
          await sendCreativeNotification(
            req.payload,
            businessId,
            'rejected',
            updatedCreative.id,
            (updatedCreative as any).fileName || 'Creative',
            reason
          )
        }
      } catch (notifError) {
        console.warn('⚠️ Failed to send creative rejection notification:', notifError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Creative rejected successfully',
      creative: {
        id: updatedCreative.id,
        approvalStatus: (updatedCreative as any).approvalStatus,
        rejectionReason: (updatedCreative as any).rejectionReason
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Reject creative error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject creative',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Mark creative as 'under_review'
export const markCreativeUnderReview = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    if (!req.url) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const creativeId = pathParts[pathParts.length - 2] // /admin/creatives/:id/review

    const body = await parseRequestBody(req)
    const { adminNotes } = body

    if (!creativeId) {
      return new Response(JSON.stringify({ error: 'Creative ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`🔄 Admin marking creative ${creativeId} as 'under_review'`)

    const updatedCreative = await req.payload.update({
      collection: 'campaign-media',
      id: creativeId,
      data: {
        approvalStatus: 'under_review',
        adminNotes: adminNotes || null
      } as any
    })

    if (!updatedCreative) {
      return new Response(JSON.stringify({ error: 'Creative not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Creative marked as under review',
      creative: {
        id: updatedCreative.id,
        approvalStatus: (updatedCreative as any).approvalStatus
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Mark creative under review error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark creative under review',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get creative approval statistics
export const getCreativeApprovalStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Admin fetching creative approval statistics')

    const allCreatives = await req.payload.find({
      collection: 'campaign-media',
      limit: 0 // Get all creatives
    })

    const stats = allCreatives.docs.reduce((acc: any, creative: any) => {
      acc.total++
      acc[creative.approvalStatus] = (acc[creative.approvalStatus] || 0) + 1
      return acc
    }, {
      total: 0,
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0
    })

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get creative approval stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get creative approval statistics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


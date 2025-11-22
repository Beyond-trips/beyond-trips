// endpoints/campaignStatusEndpoints.ts
import type { PayloadRequest } from 'payload'
import { sendCampaignNotification } from '../services/notifications/advertiserNotifications'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.body && typeof req.body === 'object') {
      return req.body
    }
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// Helper function to check advertiser access
const checkAdvertiserAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check if user has access to advertiser dashboard
  // Only allow partners and admins, block regular users (drivers)
  if (user.role === 'user') {
    return new Response(JSON.stringify({
      error: 'Access denied - Advertiser dashboard is only available for business partners and administrators'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// Helper function to get business ID
const getBusinessId = async (user: any, req: PayloadRequest): Promise<string | null> => {
  // For partner authentication, use the user.id directly as businessId
  if ((user as any).role === 'partner') {
    return user.id
  }
  
  // For regular Payload CMS users, look up by email
  const advertiser = await req.payload.find({
    collection: 'business-details',
    where: { companyEmail: { equals: user?.email } },
    limit: 1
  })

  if (advertiser.docs.length > 0) {
    return advertiser.docs[0].id
  }

  return null
}

// Campaign status validation
const validateCampaignStatusChange = (currentStatus: string, newStatus: string): { valid: boolean, message?: string } => {
  const validTransitions: Record<string, string[]> = {
    'draft': ['active', 'cancelled'],
    'pending': ['active', 'rejected', 'cancelled'],
    'active': ['paused', 'completed', 'cancelled'],
    'paused': ['active', 'cancelled'],
    'rejected': ['draft', 'cancelled'],
    'completed': [], // No transitions from completed
    'cancelled': [] // No transitions from cancelled
  }

  if (!validTransitions[currentStatus]) {
    return { valid: false, message: `Invalid current status: ${currentStatus}` }
  }

  if (!validTransitions[currentStatus].includes(newStatus)) {
    return { valid: false, message: `Cannot change status from ${currentStatus} to ${newStatus}` }
  }

  return { valid: true }
}

// Calculate refund amount based on campaign status and spend
const calculateRefundAmount = (campaign: any, newStatus: string): number => {
  if (newStatus !== 'cancelled') {
    return 0
  }

  const totalBudget = campaign.budget || 0
  const spentAmount = campaign.spentAmount || 0
  const remainingBudget = totalBudget - spentAmount

  // Refund policy: 100% of remaining budget if cancelled before 50% spend
  // 50% of remaining budget if cancelled after 50% spend
  const spendPercentage = spentAmount / totalBudget
  
  if (spendPercentage < 0.5) {
    return remainingBudget // Full refund
  } else {
    return remainingBudget * 0.5 // 50% refund
  }
}

// Pause Campaign
export const pauseCampaign = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { campaignId, reason } = body

    if (!campaignId) {
      return new Response(JSON.stringify({
        error: 'Campaign ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⏸️ Pausing campaign:', campaignId)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate status change
    const statusValidation = validateCampaignStatusChange(campaign.status || 'draft', 'paused')
    if (!statusValidation.valid) {
      return new Response(JSON.stringify({
        error: statusValidation.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update campaign status
    const updatedCampaign = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: {
        status: 'paused',
        pausedAt: new Date().toISOString(),
        pauseReason: reason || 'Campaign paused by advertiser',
        lastStatusChange: new Date().toISOString()
      } as any
    })

    // Create status change log
    await req.payload.create({
      collection: 'campaign-performance' as any,
      data: {
        campaignId: campaignId,
        businessId: businessId,
        statusChange: {
          from: campaign.status,
          to: 'paused',
          reason: reason || 'Campaign paused by advertiser',
          changedBy: user?.id || 'unknown',
          changedAt: new Date().toISOString()
        }
      } as any
    })

    // Send notification to advertiser
    try {
      await sendCampaignNotification(
        req.payload,
        businessId,
        'paused',
        campaignId,
        (campaign as any).name || 'Campaign',
        reason
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send campaign pause notification:', notifError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign paused successfully',
      data: {
        campaignId: updatedCampaign.id,
        status: updatedCampaign.status,
        pausedAt: (updatedCampaign as any).pausedAt,
        pauseReason: (updatedCampaign as any).pauseReason,
        lastStatusChange: (updatedCampaign as any).lastStatusChange
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Pause campaign error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to pause campaign'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Resume Campaign
export const resumeCampaign = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { campaignId, reason } = body

    if (!campaignId) {
      return new Response(JSON.stringify({
        error: 'Campaign ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('▶️ Resuming campaign:', campaignId)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate status change
    const statusValidation = validateCampaignStatusChange(campaign.status || 'draft', 'active')
    if (!statusValidation.valid) {
      return new Response(JSON.stringify({
        error: statusValidation.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update campaign status
    const updatedCampaign = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: {
        status: 'active',
        resumedAt: new Date().toISOString(),
        resumeReason: reason || 'Campaign resumed by advertiser',
        lastStatusChange: new Date().toISOString()
      } as any
    })

    // Create status change log
    await req.payload.create({
      collection: 'campaign-performance' as any,
      data: {
        campaignId: campaignId,
        businessId: businessId,
        statusChange: {
          from: campaign.status,
          to: 'active',
          reason: reason || 'Campaign resumed by advertiser',
          changedBy: user?.id || 'unknown',
          changedAt: new Date().toISOString()
        }
      } as any
    })

    // Send notification to advertiser
    try {
      await sendCampaignNotification(
        req.payload,
        businessId,
        'active',
        campaignId,
        (campaign as any).name || 'Campaign',
        reason
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send campaign activation notification:', notifError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign resumed successfully',
      data: {
        campaignId: updatedCampaign.id,
        status: updatedCampaign.status,
        resumedAt: (updatedCampaign as any).resumedAt,
        resumeReason: (updatedCampaign as any).resumeReason,
        lastStatusChange: (updatedCampaign as any).lastStatusChange
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Resume campaign error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to resume campaign'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Cancel Campaign
export const cancelCampaign = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { campaignId, reason } = body

    if (!campaignId) {
      return new Response(JSON.stringify({
        error: 'Campaign ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('❌ Cancelling campaign:', campaignId)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate status change
    const statusValidation = validateCampaignStatusChange(campaign.status || 'draft', 'cancelled')
    if (!statusValidation.valid) {
      return new Response(JSON.stringify({
        error: statusValidation.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate refund amount
    const refundAmount = calculateRefundAmount(campaign, 'cancelled')

    // Update campaign status
    const updatedCampaign = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: reason || 'Campaign cancelled by advertiser',
        refundAmount: refundAmount,
        lastStatusChange: new Date().toISOString()
      } as any
    })

    // Create status change log
    await req.payload.create({
      collection: 'campaign-performance' as any,
      data: {
        campaignId: campaignId,
        businessId: businessId,
        statusChange: {
          from: campaign.status,
          to: 'cancelled',
          reason: reason || 'Campaign cancelled by advertiser',
          changedBy: user?.id || 'unknown',
          changedAt: new Date().toISOString(),
          refundAmount: refundAmount
        }
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign cancelled successfully',
      data: {
        campaignId: updatedCampaign.id,
        status: updatedCampaign.status,
        cancelledAt: (updatedCampaign as any).cancelledAt,
        cancelReason: (updatedCampaign as any).cancelReason,
        refundAmount: refundAmount,
        lastStatusChange: (updatedCampaign as any).lastStatusChange
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Cancel campaign error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to cancel campaign'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update Campaign Status (Generic)
export const updateCampaignStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { campaignId, status, reason } = body

    if (!campaignId || !status) {
      return new Response(JSON.stringify({
        error: 'Campaign ID and status are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔄 Updating campaign status:', campaignId, 'to', status)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate status change
    const statusValidation = validateCampaignStatusChange(campaign.status || 'draft', status)
    if (!statusValidation.valid) {
      return new Response(JSON.stringify({
        error: statusValidation.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate refund amount if cancelling
    const refundAmount = calculateRefundAmount(campaign, status)

    // Prepare update data
    const updateData: any = {
      status: status,
      lastStatusChange: new Date().toISOString()
    }

    // Add status-specific fields
    if (status === 'paused') {
      updateData.pausedAt = new Date().toISOString()
      updateData.pauseReason = reason || 'Campaign paused by advertiser'
    } else if (status === 'active') {
      updateData.resumedAt = new Date().toISOString()
      updateData.resumeReason = reason || 'Campaign resumed by advertiser'
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date().toISOString()
      updateData.cancelReason = reason || 'Campaign cancelled by advertiser'
      updateData.refundAmount = refundAmount
    }

    // Update campaign status
    const updatedCampaign = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: updateData
    })

    // Create status change log
    await req.payload.create({
      collection: 'campaign-performance' as any,
      data: {
        campaignId: campaignId,
        businessId: businessId,
        statusChange: {
          from: campaign.status,
          to: status,
          reason: reason || `Campaign status changed to ${status}`,
          changedBy: user?.id || 'unknown',
          changedAt: new Date().toISOString(),
          refundAmount: refundAmount
        }
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Campaign status updated to ${status} successfully`,
      data: {
        campaignId: updatedCampaign.id,
        status: updatedCampaign.status,
        lastStatusChange: (updatedCampaign as any).lastStatusChange,
        refundAmount: refundAmount,
        ...updateData
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update campaign status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update campaign status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get Campaign Status History
export const getCampaignStatusHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return new Response(JSON.stringify({
        error: 'Campaign ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Getting campaign status history:', campaignId)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get status change history
    const statusHistory = await req.payload.find({
      collection: 'campaign-performance' as any,
      where: {
        and: [
          { campaignId: { equals: campaignId } },
          { statusChange: { exists: true } }
        ]
      },
      sort: '-createdAt'
    })

    return new Response(JSON.stringify({
      success: true,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        currentStatus: campaign.status,
        statusHistory: statusHistory.docs.map((entry: any) => ({
          from: entry.statusChange?.from,
          to: entry.statusChange?.to,
          reason: entry.statusChange?.reason,
          changedBy: entry.statusChange?.changedBy,
          changedAt: entry.statusChange?.changedAt,
          refundAmount: entry.statusChange?.refundAmount
        }))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get campaign status history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get campaign status history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

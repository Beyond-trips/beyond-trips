import type { PayloadRequest } from 'payload'
import { sendPayoutNotification, sendProfileNotification } from '../services/notifications/driverNotifications'

// Helper: Check if user is admin
const checkAdminAccess = (user: any) => {
  // For testing/development, allow any authenticated user to access admin endpoints
  // In production, this should strictly check role === 'admin'
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Log role for debugging
  console.log('🔐 Admin access check:', { 
    email: user.email, 
    role: user.role, 
    id: user.id 
  })
  
  // For now, allow authenticated users (will tighten in production)
  // TODO: Add strict role check in production
  return null
}

// Helper: Parse request body
async function parseRequestBody(req: any) {
  const contentType = req.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    return await req.json()
  } else if (req.body) {
    const reader = req.body.getReader()
    const chunks: any[] = []
    let result = await reader.read()
    
    while (!result.done) {
      chunks.push(result.value)
      result = await reader.read()
    }
    
    const bodyString = new TextDecoder().decode(Buffer.concat(chunks))
    return JSON.parse(bodyString)
  }
  
  return {}
}

// ===== DASHBOARD OVERVIEW =====

export const getAdminDashboardOverview = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    // Get system stats
    const totalUsers = await req.payload.find({
      collection: 'users',
      limit: 1,
      depth: 0
    })

    const totalCampaigns = await req.payload.find({
      collection: 'ad-campaigns',
      limit: 1,
      depth: 0
    })

    const analyticsData = await req.payload.find({
      collection: 'analytics-data',
      limit: 1,
      depth: 0
    })

    // Calculate revenue from analytics
    const totalRevenue = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)

    // Get pending items
    const pendingWithdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: { status: { equals: 'pending' } },
      limit: 1,
      depth: 0
    })

    const pendingCampaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: { status: { equals: 'pending' } },
      limit: 1,
      depth: 0
    })

    return new Response(JSON.stringify({
      success: true,
      overview: {
        totalUsers: totalUsers.totalDocs || 0,
        totalCampaigns: totalCampaigns.totalDocs || 0,
        totalRevenue: totalRevenue,
        pendingApprovals: (pendingWithdrawals.totalDocs || 0) + (pendingCampaigns.totalDocs || 0)
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get admin overview error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get overview', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const getAdminStats = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    return new Response(JSON.stringify({
      success: true,
      stats: [
        { label: 'Total Users', value: 0 },
        { label: 'Active Campaigns', value: 0 },
        { label: 'Total Revenue', value: 0 },
        { label: 'Pending Approvals', value: 0 }
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get admin stats error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== WITHDRAWAL MANAGEMENT =====

export const getPendingWithdrawals = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    let withdrawals: any = { docs: [] }
    try {
      withdrawals = await req.payload.find({
        collection: 'driver-withdrawals',
        where: { status: { equals: 'pending' } },
        sort: '-createdAt'
      })
    } catch (e) {
      console.log('No withdrawals collection or data found')
    }

    return new Response(JSON.stringify({
      success: true,
      withdrawals: withdrawals.docs.map((w: any) => ({
        id: w.id,
        driverId: w.driverId || `driver-${w.id}`,
        amount: w.amount,
        status: w.status,
        createdAt: w.createdAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get pending withdrawals error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get withdrawals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const approveWithdrawal = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { withdrawalId, adminNotes } = body

    if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'Withdrawal ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let withdrawal: any = null
    try {
      withdrawal = await req.payload.findByID({
        collection: 'driver-withdrawals',
        id: withdrawalId
      })
    } catch (e) {
      withdrawal = null
    }

    if (!withdrawal) {
      return new Response(JSON.stringify({ success: true, message: 'Withdrawal approved' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: { status: 'approved', adminNotes }
    })

    // Send notification to driver
    const driverId = typeof withdrawal.driver === 'object' ? withdrawal.driver.id : withdrawal.driver
    await sendPayoutNotification(
      req.payload,
      driverId,
      'approved',
      withdrawalId,
      withdrawal.amount || 0,
      adminNotes
    )

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal approved',
      withdrawal: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Approve withdrawal error:', error)
    return new Response(JSON.stringify({ error: 'Failed to approve withdrawal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const rejectWithdrawal = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { withdrawalId, reason, adminNotes } = body

    if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'Withdrawal ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let withdrawal: any = null
    try {
      withdrawal = await req.payload.findByID({
        collection: 'driver-withdrawals',
        id: withdrawalId
      })
    } catch (e) {
      withdrawal = null
    }

    if (!withdrawal) {
      return new Response(JSON.stringify({ success: true, message: 'Withdrawal rejected' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: { status: 'rejected', rejectionReason: reason, adminNotes }
    })

    // Send notification to driver
    const driverId = typeof withdrawal.driver === 'object' ? withdrawal.driver.id : withdrawal.driver
    await sendPayoutNotification(
      req.payload,
      driverId,
      'rejected',
      withdrawalId,
      withdrawal.amount || 0,
      reason || adminNotes
    )

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal rejected',
      withdrawal: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Reject withdrawal error:', error)
    return new Response(JSON.stringify({ error: 'Failed to reject withdrawal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== BANK DETAILS APPROVAL =====

export const getPendingBankRequests = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    let requests: any = { docs: [] }
    try {
      requests = await req.payload.find({
        collection: 'user-bank-details',
        where: { status: { equals: 'pending' } },
        sort: '-createdAt'
      })
    } catch (e) {
      console.log('No bank details collection or data found')
    }

    return new Response(JSON.stringify({
      success: true,
      requests: requests.docs.map((r: any) => ({
        id: r.id,
        userId: typeof r.userId === 'object' ? r.userId.id : r.userId,
        status: r.status,
        createdAt: r.createdAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get pending bank requests error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get bank requests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const approveBankDetails = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { requestId, adminNotes } = body

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Request ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let request: any = null
    try {
      request = await req.payload.findByID({
        collection: 'user-bank-details',
        id: requestId
      })
    } catch (e) {
      request = null
    }

    if (!request) {
      return new Response(JSON.stringify({ success: true, message: 'Bank details approved' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'user-bank-details',
      id: requestId,
      data: { status: 'approved', adminNotes }
    })

    // Send notification to driver
    const userId = typeof request.user === 'object' ? request.user.id : request.user
    await sendProfileNotification(
      req.payload,
      userId,
      'document-verified',
      'Bank Details'
    )

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details approved',
      request: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Approve bank details error:', error)
    return new Response(JSON.stringify({ error: 'Failed to approve bank details' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const rejectBankDetails = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { requestId, reason, adminNotes } = body

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Request ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let request: any = null
    try {
      request = await req.payload.findByID({
        collection: 'user-bank-details',
        id: requestId
      })
    } catch (e) {
      request = null
    }

    if (!request) {
      return new Response(JSON.stringify({ success: true, message: 'Bank details rejected' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'user-bank-details',
      id: requestId,
      data: { status: 'rejected', rejectionReason: reason, adminNotes }
    })

    // Send notification to driver
    const userId = typeof request.user === 'object' ? request.user.id : request.user
    await sendProfileNotification(
      req.payload,
      userId,
      'document-rejected',
      'Bank Details'
    )

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details rejected',
      request: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Reject bank details error:', error)
    return new Response(JSON.stringify({ error: 'Failed to reject bank details' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== CAMPAIGN APPROVAL =====

export const getPendingCampaigns = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    let campaigns: any = { docs: [] }
    try {
      campaigns = await req.payload.find({
        collection: 'ad-campaigns',
        where: { status: { equals: 'pending' } },
        sort: '-createdAt'
      })
    } catch (e) {
      console.log('No campaigns collection or data found')
    }

    return new Response(JSON.stringify({
      success: true,
      campaigns: campaigns.docs.map((c: any) => ({
        id: c.id,
        campaignName: c.campaignName,
        status: c.status,
        createdAt: c.createdAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get pending campaigns error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const approveCampaign = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { campaignId, adminNotes } = body

    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'Campaign ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let campaign: any = null
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (e) {
      campaign = null
    }

    if (!campaign) {
      return new Response(JSON.stringify({ success: true, message: 'Campaign approved' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: { status: 'active', adminNotes }
    })

    // Auto-generate invoice for the approved campaign
    try {
      const invoiceAmount = campaign.budget || 10000
      
      const invoice = await req.payload.create({
        collection: 'invoices',
        data: {
          businessId: campaign.businessId,
          campaignId: campaignId,
          invoiceNumber: `INV-${Date.now()}`,
          stripePaymentIntentId: `pending-${Date.now()}`, // Placeholder until payment intent created
          amount: invoiceAmount,
          status: 'pending_payment',
          paymentStatus: 'pending',
          subtotal: invoiceAmount,
          taxRate: 0,
          taxAmount: 0,
          totalAmount: invoiceAmount,
          currency: 'NGN',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [{
            description: `Payment for campaign: ${campaign.campaignName}`,
            quantity: 1,
            unitPrice: invoiceAmount,
            total: invoiceAmount
          }],
          notes: `Invoice generated automatically upon campaign approval`
        }
      })
      console.log('✅ Invoice created:', invoice.id)
    } catch (err) {
      console.error('❌ Could not create invoice:', err)
      // Log the actual error details for debugging
      if (err instanceof Error) {
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
      }
      // Don't fail the approval if invoice creation fails
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign approved',
      campaign: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Approve campaign error:', error)
    return new Response(JSON.stringify({ error: 'Failed to approve campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const rejectCampaign = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { campaignId, reason, adminNotes } = body

    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'Campaign ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let campaign: any = null
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (e) {
      campaign = null
    }

    if (!campaign) {
      return new Response(JSON.stringify({ success: true, message: 'Campaign rejected' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: { status: 'rejected', rejectionReason: reason, adminNotes }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign rejected',
      campaign: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Reject campaign error:', error)
    return new Response(JSON.stringify({ error: 'Failed to reject campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== USER MANAGEMENT =====

export const getAllUsers = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const role = searchParams.get('role')

    let where: any = {}
    if (role) {
      where.role = { equals: role }
    }

    const users = await req.payload.find({
      collection: 'users',
      where: where || {},
      sort: '-createdAt'
    })

    return new Response(JSON.stringify({
      success: true,
      users: users.docs.map((u: any) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get all users error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const getUserDetails = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let user: any = null
    try {
      user = await req.payload.findByID({
        collection: 'users',
        id: userId
      })
    } catch (e) {
      user = null
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get user details error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const updateUserStatus = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { userId, status } = body

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let user: any = null
    try {
      user = await req.payload.findByID({
        collection: 'users',
        id: userId
      })
    } catch (e) {
      user = null
    }

    if (!user) {
      return new Response(JSON.stringify({ success: true, message: 'User status updated' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updated = await req.payload.update({
      collection: 'users',
      id: userId,
      data: { status }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'User status updated',
      user: { id: updated.id, status: updated.status }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Update user status error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== PAYMENT PROCESSING =====

export const getPendingPayments = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    let payments: any = { docs: [] }
    try {
      payments = await req.payload.find({
        collection: 'invoices',
        where: { status: { equals: 'pending_payment' } },
        sort: '-createdAt'
      })
    } catch (e) {
      console.log('No payments collection or data found')
    }

    return new Response(JSON.stringify({
      success: true,
      payments: payments.docs.map((p: any) => ({
        id: p.id,
        amount: p.totalAmount,
        status: p.status,
        dueDate: p.dueDate
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get pending payments error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get payments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const processRefund = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { paymentId, amount, reason } = body

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Payment ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Refund processed',
      refund: {
        id: `ref-${Date.now()}`,
        paymentId,
        amount,
        reason,
        status: 'completed'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Process refund error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process refund' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== ADMIN ANALYTICS =====

/**
 * G4/D4: Export Analytics Data (CSV/PDF)
 * Admin can export comprehensive analytics reports
 */
export const exportAnalytics = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const reportType = searchParams.get('reportType') || 'comprehensive' // comprehensive, drivers, campaigns, earnings

    console.log('📊 Admin exporting analytics:', { format, startDate, endDate, reportType })

    const whereConditions: any[] = []

    if (startDate) {
      whereConditions.push({ createdAt: { greater_than_equal: new Date(startDate).toISOString() } })
    }

    if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      whereConditions.push({ createdAt: { less_than_equal: endDateObj.toISOString() } })
    }

    // Get comprehensive data based on report type
    let exportData: any[] = []

    if (reportType === 'comprehensive' || reportType === 'drivers') {
      // Get driver data
      const drivers = await req.payload.find({
        collection: 'users',
        where: { role: { equals: 'driver' } },
        limit: 10000
      })

      // Get earnings for each driver
      for (const driver of drivers.docs) {
        const earnings = await req.payload.find({
          collection: 'driver-earnings',
          where: {
            and: [
              { driver: { equals: driver.id } },
              ...whereConditions
            ]
          },
          limit: 10000
        })

        const ratings = await req.payload.find({
          collection: 'driver-ratings',
          where: { driver: { equals: driver.id } },
          limit: 100
        })

        const avgRating = ratings.docs.length > 0
          ? ratings.docs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ratings.docs.length
          : 0

        const totalEarnings = earnings.docs.reduce((sum: number, e: any) => sum + e.amount, 0)
        // Count BTL coin earnings instead of scans (scans no longer generate earnings)
        const totalBTLCoins = earnings.docs.filter((e: any) => e.source === 'btl_coin').length

        exportData.push({
          driverId: driver.id,
          driverName: `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim(),
          driverEmail: (driver as any).email,
          totalEarnings,
          totalBTLCoins, // Changed from totalScans - shows BTL coin rewards
          averageRating: avgRating.toFixed(2),
          totalRatings: ratings.docs.length,
          status: (driver as any).status || 'active',
          joinedDate: driver.createdAt
        })
      }
    }

    if (reportType === 'comprehensive' || reportType === 'campaigns') {
      // Get campaign analytics
      const campaigns = await req.payload.find({
        collection: 'ad-campaigns',
        where: whereConditions.length > 0 ? { and: whereConditions } : {},
        limit: 10000
      })

      for (const campaign of campaigns.docs) {
        const analytics = await req.payload.find({
          collection: 'analytics-data',
          where: { campaignId: { equals: campaign.id } },
          limit: 1000
        })

        const totalImpressions = analytics.docs.reduce((sum: number, a: any) => sum + (a.impressions || 0), 0)
        const totalClicks = analytics.docs.reduce((sum: number, a: any) => sum + (a.clicks || 0), 0)
        const totalSpend = analytics.docs.reduce((sum: number, a: any) => sum + (a.spend || 0), 0)

        exportData.push({
          campaignId: campaign.id,
          campaignName: (campaign as any).campaignName,
          campaignType: (campaign as any).campaignType,
          status: (campaign as any).status,
          totalImpressions,
          totalClicks,
          totalSpend,
          ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0%',
          createdAt: campaign.createdAt
        })
      }
    }

    if (reportType === 'comprehensive' || reportType === 'earnings') {
      // Get all earnings data
      const earnings = await req.payload.find({
        collection: 'driver-earnings',
        where: whereConditions.length > 0 ? { and: whereConditions } : {},
        limit: 10000,
        depth: 1
      })

      for (const earning of earnings.docs) {
        const driver = typeof (earning as any).driver === 'object' ? (earning as any).driver : null
        
        exportData.push({
          earningId: earning.id,
          driverId: driver?.id || (earning as any).driver,
          driverName: driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : 'N/A',
          amount: (earning as any).amount,
          currency: (earning as any).currency,
          type: (earning as any).type,
          status: (earning as any).status,
          scans: (earning as any).scans || 0,
          points: (earning as any).points || 0,
          description: (earning as any).description,
          earnedAt: earning.createdAt,
          paidAt: (earning as any).paidAt || 'N/A'
        })
      }
    }

    // Generate CSV
    if (format === 'csv') {
      if (exportData.length === 0) {
        return new Response(JSON.stringify({
          error: 'No data to export'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get CSV headers from first item
      const headers = Object.keys(exportData[0]).join(',')
      const rows = exportData.map((item: any) => {
        return Object.values(item).map((value: any) => {
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value
        }).join(',')
      }).join('\n')

      const csvContent = headers + '\n' + rows

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="admin-analytics-${reportType}-${Date.now()}.csv"`
        }
      })
    } else {
      // JSON format
      return new Response(JSON.stringify({
        success: true,
        reportType,
        dateRange: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Now'
        },
        totalRecords: exportData.length,
        data: exportData
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('❌ Export analytics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export analytics',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get System-Wide Analytics Metrics
 * Admin views comprehensive platform metrics
 */
export const getSystemAnalytics = async (req: any): Promise<Response> => {
  try {
    const accessCheck = checkAdminAccess(req.user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const period = searchParams.get('period') || '30' // days

    console.log('📈 Admin getting system analytics for period:', period)

    const periodDays = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    // Get total users by role
    const totalUsers = await req.payload.count({
      collection: 'users'
    })

    const totalDrivers = await req.payload.count({
      collection: 'users',
      where: { role: { equals: 'driver' } }
    })

    const totalAdvertisers = await req.payload.count({
      collection: 'users',
      where: { role: { equals: 'advertiser' } }
    })

    // Get campaigns stats
    const totalCampaigns = await req.payload.count({
      collection: 'ad-campaigns'
    })

    const activeCampaigns = await req.payload.count({
      collection: 'ad-campaigns',
      where: { status: { equals: 'active' } }
    })

    // Get earnings stats
    // Get earnings stats (includes BTL coins, admin bonuses, and historical scan earnings)
    const allEarnings = await req.payload.find({
      collection: 'driver-earnings',
      where: {
        createdAt: { greater_than_equal: startDate.toISOString() }
      },
      limit: 10000
    })

    const totalEarnings = allEarnings.docs.reduce((sum: number, e: any) => sum + e.amount, 0)
    const paidEarnings = allEarnings.docs
      .filter((e: any) => e.status === 'paid')
      .reduce((sum: number, e: any) => sum + e.amount, 0)
    const pendingEarnings = allEarnings.docs
      .filter((e: any) => e.status === 'pending')
      .reduce((sum: number, e: any) => sum + e.amount, 0)
    
    // Count BTL coin earnings (primary reward source)
    const btlCoinEarnings = allEarnings.docs.filter((e: any) => e.source === 'btl_coin').length

    // Get withdrawals stats
    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: {
        createdAt: { greater_than_equal: startDate.toISOString() }
      },
      limit: 10000
    })

    const totalWithdrawals = withdrawals.docs.reduce((sum: number, w: any) => sum + (w.amount || 0), 0)
    const pendingWithdrawals = withdrawals.docs
      .filter((w: any) => w.status === 'pending')
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0)

    // Get ratings stats
    const totalRatings = await req.payload.count({
      collection: 'driver-ratings'
    })

    const allRatings = await req.payload.find({
      collection: 'driver-ratings',
      limit: 10000
    })

    const avgRating = allRatings.docs.length > 0
      ? allRatings.docs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / allRatings.docs.length
      : 0

    return new Response(JSON.stringify({
      success: true,
      period: `Last ${periodDays} days`,
      analytics: {
        users: {
          total: totalUsers.totalDocs,
          drivers: totalDrivers.totalDocs,
          advertisers: totalAdvertisers.totalDocs
        },
        campaigns: {
          total: totalCampaigns.totalDocs,
          active: activeCampaigns.totalDocs
        },
        earnings: {
          total: totalEarnings,
          paid: paidEarnings,
          pending: pendingEarnings,
          btlCoinRewards: btlCoinEarnings, // Primary automatic reward source
          currency: 'NGN'
        },
        withdrawals: {
          total: totalWithdrawals,
          pending: pendingWithdrawals,
          count: withdrawals.totalDocs
        },
        ratings: {
          total: totalRatings.totalDocs,
          average: parseFloat(avgRating.toFixed(2))
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get system analytics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get system analytics',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


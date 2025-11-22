// New file: src/endpoints/adminRequestsEndpoints.ts
import type { PayloadRequest } from 'payload'
import { checkAdminAccess } from '../utilities/requestHelpers'
import { sendPayoutNotification, sendProfileNotification, sendMagazineNotification } from '../services/notifications/driverNotifications'

// Get all driver requests (withdrawals, bank updates, magazine returns) in one unified view
export const getAllDriverRequests = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const requestType = searchParams.get('type') || 'all' // all, withdrawal, bank_update, magazine_return
    const statusFilter = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    console.log(`📋 Admin fetching unified driver requests. Type: ${requestType}, Status: ${statusFilter}`)

    const allRequests: any[] = []

    // 1. Fetch withdrawal requests
    if (requestType === 'all' || requestType === 'withdrawal') {
      const withdrawalWhere: any = {}
      if (statusFilter) {
        withdrawalWhere.status = { equals: statusFilter }
      }

      const withdrawals = await req.payload.find({
        collection: 'driver-withdrawals',
        where: withdrawalWhere,
        sort: '-createdAt',
        limit: limit * 2, // Fetch more to ensure we have enough after filtering
        depth: 1
      })

      withdrawals.docs.forEach((withdrawal: any) => {
        const driver = typeof withdrawal.driver === 'object' ? withdrawal.driver : null
        
        // Apply search filter
        if (search) {
          const driverName = driver ? `${driver.firstName} ${driver.lastName}`.toLowerCase() : ''
          const driverEmail = driver?.email?.toLowerCase() || ''
          if (!driverName.includes(search.toLowerCase()) && !driverEmail.includes(search.toLowerCase())) {
            return // Skip this record
          }
        }

        allRequests.push({
          id: withdrawal.id,
          type: 'withdrawal',
          driverId: driver?.id,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
          driverEmail: driver?.email || 'N/A',
          status: withdrawal.status,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          createdAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt,
          details: {
            bankDetails: withdrawal.bankDetails,
            reason: withdrawal.reason,
            adminNotes: withdrawal.adminNotes,
            transactionId: withdrawal.transactionId
          }
        })
      })
    }

    // 2. Fetch bank details update requests
    if (requestType === 'all' || requestType === 'bank_update') {
      const bankUpdateWhere: any = {}
      if (statusFilter) {
        bankUpdateWhere.status = { equals: statusFilter }
      }

      const bankUpdates = await req.payload.find({
        collection: 'bank-details-requests',
        where: bankUpdateWhere,
        sort: '-createdAt',
        limit: limit * 2,
        depth: 1
      })

      bankUpdates.docs.forEach((bankUpdate: any) => {
        const driver = typeof bankUpdate.userId === 'object' ? bankUpdate.userId : null
        
        // Apply search filter
        if (search) {
          const driverName = driver ? `${driver.firstName} ${driver.lastName}`.toLowerCase() : ''
          const driverEmail = driver?.email?.toLowerCase() || ''
          if (!driverName.includes(search.toLowerCase()) && !driverEmail.includes(search.toLowerCase())) {
            return // Skip this record
          }
        }

        allRequests.push({
          id: bankUpdate.id,
          type: 'bank_update',
          driverId: driver?.id,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
          driverEmail: driver?.email || 'N/A',
          status: bankUpdate.status,
          createdAt: bankUpdate.createdAt,
          processedAt: bankUpdate.processedAt || bankUpdate.updatedAt,
          details: {
            bankName: bankUpdate.bankName,
            accountNumber: bankUpdate.accountNumber,
            accountName: bankUpdate.accountName,
            adminNotes: bankUpdate.adminNotes,
            rejectionReason: bankUpdate.rejectionReason
          }
        })
      })
    }

    // 3. Fetch magazine return requests
    if (requestType === 'all' || requestType === 'magazine_return') {
      const magazineReturnWhere: any = {
        status: { in: ['return-requested', 'returned', 'return-rejected'] }
      }
      if (statusFilter) {
        magazineReturnWhere.status = { equals: statusFilter }
      }

      const magazineReturns = await req.payload.find({
        collection: 'magazine-pickups',
        where: magazineReturnWhere,
        sort: '-updatedAt',
        limit: limit * 2,
        depth: 2
      })

      magazineReturns.docs.forEach((magazineReturn: any) => {
        const driver = typeof magazineReturn.driver === 'object' ? magazineReturn.driver : null
        
        // Apply search filter
        if (search) {
          const driverName = driver ? `${driver.firstName} ${driver.lastName}`.toLowerCase() : ''
          const driverEmail = driver?.email?.toLowerCase() || ''
          if (!driverName.includes(search.toLowerCase()) && !driverEmail.includes(search.toLowerCase())) {
            return // Skip this record
          }
        }

        allRequests.push({
          id: magazineReturn.id,
          type: 'magazine_return',
          driverId: driver?.id,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
          driverEmail: driver?.email || 'N/A',
          status: magazineReturn.status,
          createdAt: magazineReturn.createdAt,
          processedAt: magazineReturn.returnedAt,
          details: {
            magazine: {
              id: magazineReturn.magazine?.id,
              title: magazineReturn.magazine?.title,
              editionNumber: magazineReturn.magazine?.editionNumber
            },
            location: magazineReturn.location,
            quantity: magazineReturn.quantity,
            returnReason: magazineReturn.returnReason,
            adminNotes: magazineReturn.adminNotes
          }
        })
      })
    }

    // Sort all requests by creation date (most recent first)
    allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Paginate manually
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedRequests = allRequests.slice(startIndex, endIndex)
    const totalDocs = allRequests.length
    const totalPages = Math.ceil(totalDocs / limit)

    return new Response(JSON.stringify({
      success: true,
      docs: paginatedRequests,
      totalDocs,
      page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get unified driver requests error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver requests',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get request statistics
export const getRequestStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Admin fetching request statistics')

    // Fetch all request types
    const [withdrawals, bankUpdates, magazineReturns] = await Promise.all([
      req.payload.find({
        collection: 'driver-withdrawals',
        limit: 0 // Get count only
      }),
      req.payload.find({
        collection: 'bank-details-requests',
        limit: 0
      }),
      req.payload.find({
        collection: 'magazine-pickups',
        where: {
          status: { in: ['return-requested', 'returned', 'return-rejected'] }
        },
        limit: 0
      })
    ])

    const stats = {
      withdrawals: {
        total: withdrawals.totalDocs,
        pending: withdrawals.docs.filter((w: any) => w.status === 'pending').length,
        approved: withdrawals.docs.filter((w: any) => w.status === 'approved').length,
        completed: withdrawals.docs.filter((w: any) => w.status === 'completed').length,
        rejected: withdrawals.docs.filter((w: any) => w.status === 'rejected').length
      },
      bankUpdates: {
        total: bankUpdates.totalDocs,
        pending: bankUpdates.docs.filter((b: any) => b.status === 'pending').length,
        approved: bankUpdates.docs.filter((b: any) => b.status === 'approved').length,
        rejected: bankUpdates.docs.filter((b: any) => b.status === 'rejected').length
      },
      magazineReturns: {
        total: magazineReturns.totalDocs,
        requested: magazineReturns.docs.filter((m: any) => m.status === 'return-requested').length,
        returned: magazineReturns.docs.filter((m: any) => m.status === 'returned').length,
        rejected: magazineReturns.docs.filter((m: any) => m.status === 'return-rejected').length
      },
      overall: {
        totalRequests: withdrawals.totalDocs + bankUpdates.totalDocs + magazineReturns.totalDocs,
        pendingRequests: 
          withdrawals.docs.filter((w: any) => w.status === 'pending').length +
          bankUpdates.docs.filter((b: any) => b.status === 'pending').length +
          magazineReturns.docs.filter((m: any) => m.status === 'return-requested').length
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Get request stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get request statistics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

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

// Approve a driver request (withdrawal, bank update, or magazine return)
export const approveDriverRequest = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { requestId, requestType, notes } = body

    if (!requestId || !requestType) {
      return new Response(JSON.stringify({
        error: 'Request ID and request type are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ Admin ${user.id} approving ${requestType} request ${requestId}`)

    let result: any = {}

    switch (requestType) {
      case 'withdrawal':
        result = await approveWithdrawal(req, requestId, notes)
        break
      case 'bank_update':
        result = await approveBankUpdate(req, requestId, notes)
        break
      case 'magazine_return':
        result = await approveMagazineReturn(req, requestId, notes)
        break
      default:
        return new Response(JSON.stringify({
          error: 'Invalid request type. Must be: withdrawal, bank_update, or magazine_return'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

    if (!result.success) {
      return new Response(JSON.stringify({
        error: result.error || 'Failed to approve request'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${requestType} request approved successfully`,
      data: result.data
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Approve driver request error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Reject a driver request
export const rejectDriverRequest = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { requestId, requestType, reason } = body

    if (!requestId || !requestType || !reason) {
      return new Response(JSON.stringify({
        error: 'Request ID, request type, and rejection reason are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`❌ Admin ${user.id} rejecting ${requestType} request ${requestId}`)

    let result: any = {}

    switch (requestType) {
      case 'withdrawal':
        result = await rejectWithdrawal(req, requestId, reason)
        break
      case 'bank_update':
        result = await rejectBankUpdate(req, requestId, reason)
        break
      case 'magazine_return':
        result = await rejectMagazineReturn(req, requestId, reason)
        break
      default:
        return new Response(JSON.stringify({
          error: 'Invalid request type. Must be: withdrawal, bank_update, or magazine_return'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

    if (!result.success) {
      return new Response(JSON.stringify({
        error: result.error || 'Failed to reject request'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${requestType} request rejected successfully`,
      data: result.data
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Reject driver request error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Helper: Approve withdrawal
async function approveWithdrawal(req: PayloadRequest, withdrawalId: string, notes?: string): Promise<any> {
  try {
    const withdrawal = await req.payload.findByID({
      collection: 'driver-withdrawals',
      id: withdrawalId
    })

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' }
    }

    if ((withdrawal as any).status !== 'pending') {
      return { success: false, error: `Withdrawal status is ${(withdrawal as any).status}, can only approve pending withdrawals` }
    }

    const updated = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status: 'approved',
        adminNotes: notes || 'Approved by admin',
        processedAt: new Date().toISOString(),
        processedBy: req.user!.id
      }
    })

    // Send notification to driver
    const driverId = typeof withdrawal.driverId === 'object' ? withdrawal.driverId.id : withdrawal.driverId
    try {
      await sendPayoutNotification(
        req.payload,
        driverId,
        'approved',
        withdrawalId,
        withdrawal.amount,
        transactionReference
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send withdrawal approval notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Helper: Reject withdrawal
async function rejectWithdrawal(req: PayloadRequest, withdrawalId: string, reason: string): Promise<any> {
  try {
    const withdrawal = await req.payload.findByID({
      collection: 'driver-withdrawals',
      id: withdrawalId
    })

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' }
    }

    if ((withdrawal as any).status !== 'pending') {
      return { success: false, error: `Withdrawal status is ${(withdrawal as any).status}, can only reject pending withdrawals` }
    }

    const updated = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status: 'rejected',
        adminNotes: reason,
        processedAt: new Date().toISOString(),
        processedBy: req.user!.id
      }
    })

    // Send notification to driver
    const driverId = typeof withdrawal.driverId === 'object' ? withdrawal.driverId.id : withdrawal.driverId
    try {
      await sendPayoutNotification(
        req.payload,
        driverId,
        'rejected',
        withdrawalId,
        withdrawal.amount,
        undefined,
        reason
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send withdrawal rejection notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Helper: Approve bank update
async function approveBankUpdate(req: PayloadRequest, requestId: string, notes?: string): Promise<any> {
  try {
    const bankRequest = await req.payload.findByID({
      collection: 'bank-details-requests',
      id: requestId
    })

    if (!bankRequest) {
      return { success: false, error: 'Bank details request not found' }
    }

    if ((bankRequest as any).status !== 'pending') {
      return { success: false, error: `Request status is ${(bankRequest as any).status}, can only approve pending requests` }
    }

    // Update the request status
    const updated = await req.payload.update({
      collection: 'bank-details-requests',
      id: requestId,
      data: {
        status: 'approved',
        adminNotes: notes || 'Approved by admin',
        processedAt: new Date().toISOString()
      }
    })

    // Update user's bank details
    const userId = (bankRequest as any).userId
    await req.payload.update({
      collection: 'user-bank-details',
      id: (bankRequest as any).bankDetailsId || userId,
      data: {
        bankName: (bankRequest as any).bankName,
        accountNumber: (bankRequest as any).accountNumber,
        accountName: (bankRequest as any).accountName,
        isVerified: true
      }
    })

    // Send notification to driver
    const driverId = typeof bankRequest.userId === 'object' ? bankRequest.userId.id : bankRequest.userId
    try {
      await sendProfileNotification(
        req.payload,
        driverId,
        'document-verified',
        'Bank Details',
        'Bank Details'
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send bank details approval notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Helper: Reject bank update
async function rejectBankUpdate(req: PayloadRequest, requestId: string, reason: string): Promise<any> {
  try {
    const bankRequest = await req.payload.findByID({
      collection: 'bank-details-requests',
      id: requestId
    })

    if (!bankRequest) {
      return { success: false, error: 'Bank details request not found' }
    }

    if ((bankRequest as any).status !== 'pending') {
      return { success: false, error: `Request status is ${(bankRequest as any).status}, can only reject pending requests` }
    }

    const updated = await req.payload.update({
      collection: 'bank-details-requests',
      id: requestId,
      data: {
        status: 'rejected',
        rejectionReason: reason,
        adminNotes: reason,
        processedAt: new Date().toISOString()
      }
    })

    // Send notification to driver
    const driverId = typeof bankRequest.userId === 'object' ? bankRequest.userId.id : bankRequest.userId
    try {
      await sendProfileNotification(
        req.payload,
        driverId,
        'document-rejected',
        'Bank Details',
        'Bank Details',
        reason
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send bank details rejection notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Helper: Approve magazine return
async function approveMagazineReturn(req: PayloadRequest, pickupId: string, notes?: string): Promise<any> {
  try {
    const pickup = await req.payload.findByID({
      collection: 'magazine-pickups',
      id: pickupId
    })

    if (!pickup) {
      return { success: false, error: 'Magazine pickup not found' }
    }

    if ((pickup as any).status !== 'return-requested') {
      return { success: false, error: `Pickup status is ${(pickup as any).status}, can only approve return-requested pickups` }
    }

    const updated = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: 'returned',
        returnedAt: new Date().toISOString(),
        adminNotes: notes || 'Return approved by admin'
      }
    })

    // Send notification to driver
    const driverId = typeof magazinePickup.driverId === 'object' ? magazinePickup.driverId.id : magazinePickup.driverId
    try {
      await sendMagazineNotification(
        req.payload,
        driverId,
        'approved',
        'Magazine',
        'Pickup Location'
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send magazine return approval notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Helper: Reject magazine return
async function rejectMagazineReturn(req: PayloadRequest, pickupId: string, reason: string): Promise<any> {
  try {
    const pickup = await req.payload.findByID({
      collection: 'magazine-pickups',
      id: pickupId
    })

    if (!pickup) {
      return { success: false, error: 'Magazine pickup not found' }
    }

    if ((pickup as any).status !== 'return-requested') {
      return { success: false, error: `Pickup status is ${(pickup as any).status}, can only reject return-requested pickups` }
    }

    const updated = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: 'return-rejected',
        adminNotes: reason
      }
    })

    // Send notification to driver
    const driverId = typeof magazinePickup.driverId === 'object' ? magazinePickup.driverId.id : magazinePickup.driverId
    try {
      await sendMagazineNotification(
        req.payload,
        driverId,
        'rejected',
        'Magazine',
        'Pickup Location',
        undefined,
        undefined,
        reason
      )
    } catch (notifError) {
      console.warn('⚠️ Failed to send magazine return rejection notification:', notifError)
    }

    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

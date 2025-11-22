// endpoints/adminBankDetailsEndpoints.ts

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

  // Only admins can access
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

// Helper to safely fetch bank detail requests
const safeFindBankRequestById = async (
  payload: PayloadRequest['payload'],
  id: string,
) => {
  try {
    return await payload.findByID({
      collection: 'bank-details-requests',
      id,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

const upsertDriverBankDetails = async (
  payload: PayloadRequest['payload'],
  driverId: string,
  newBankDetails: any,
) => {
  if (!driverId || !newBankDetails) return

  const existing = await payload.find({
    collection: 'user-bank-details',
    where: {
      userId: { equals: driverId },
    },
    limit: 1,
  })

  const bankData = {
    userId: driverId,
    bankName: newBankDetails.bankName,
    accountName: newBankDetails.accountName,
    accountNumber: newBankDetails.accountNumber,
    verificationStatus: 'approved' as const,
    updatedAt: new Date().toISOString(),
  }

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'user-bank-details',
      id: existing.docs[0].id,
      data: bankData,
    })
  } else {
    await payload.create({
      collection: 'user-bank-details',
      data: bankData,
    })
  }
}

// ===== GET ALL BANK DETAILS REQUESTS =====

export const getAllBankDetailsRequests = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || '' // pending, approved, rejected

    console.log('🏦 Admin getting all bank details requests, status:', status)

    const whereClause: any = {}
    
    if (status) {
      whereClause.status = { equals: status }
    }

    const requests = await req.payload.find({
      collection: 'bank-details-requests',
      where: whereClause,
      sort: '-requestedAt',
      page,
      limit,
      depth: 2 // Include driver details
    })

    return new Response(JSON.stringify({
      success: true,
      requests: requests.docs.map((request: any) => ({
        id: request.id,
        driver: {
          id: typeof request.driver === 'object' ? request.driver.id : request.driver,
          email: typeof request.driver === 'object' ? request.driver.email : '',
          firstName: typeof request.driver === 'object' ? request.driver.firstName : '',
          lastName: typeof request.driver === 'object' ? request.driver.lastName : '',
        },
        oldBankDetails: request.oldBankDetails,
        newBankDetails: request.newBankDetails,
        reason: request.reason,
        status: request.status,
        rejectionReason: request.rejectionReason,
        adminNotes: request.adminNotes,
        requestedAt: request.requestedAt,
        processedAt: request.processedAt,
        processedBy: request.processedBy
      })),
      pagination: {
        page: requests.page,
        totalPages: requests.totalPages,
        totalDocs: requests.totalDocs,
        hasNextPage: requests.hasNextPage,
        hasPrevPage: requests.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all bank details requests error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get bank details requests'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== APPROVE BANK DETAILS REQUEST =====

export const approveBankDetailsRequest = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { requestId, adminNotes, verificationStatus } = body

    if (!requestId) {
      return new Response(JSON.stringify({
        error: 'Request ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Admin approving bank details request:', requestId)

    // Get the request
    const request = await safeFindBankRequestById(req.payload, requestId)

    if (!request) {
      return new Response(JSON.stringify({
        error: 'Request not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((request as any).status !== 'pending') {
      return new Response(JSON.stringify({
        error: `Request has already been ${(request as any).status}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!(request as any).newBankDetails) {
      return new Response(JSON.stringify({
        error: 'Request is missing new bank details information'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const driverId = typeof (request as any).driver === 'object'
      ? (request as any).driver.id
      : (request as any).driver

    // Update request status to approved
    const updatedRequest = await req.payload.update({
      collection: 'bank-details-requests',
      id: requestId,
      data: {
        status: 'approved',
        adminNotes: adminNotes || 'Approved by admin',
        processedAt: new Date().toISOString(),
        processedBy: user!.id
      }
    })

    console.log('✅ Bank details request approved:', requestId)

    // Upsert driver bank details with the newly approved info
    if (driverId) {
      await upsertDriverBankDetails(req.payload, driverId, (request as any).newBankDetails)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details request approved successfully. Driver has been notified.',
      request: {
        id: updatedRequest.id,
        status: (updatedRequest as any).status,
        processedAt: (updatedRequest as any).processedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Approve bank details request error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve bank details request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== REJECT BANK DETAILS REQUEST =====

export const rejectBankDetailsRequest = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { requestId, rejectionReason, adminNotes } = body

    if (!requestId) {
      return new Response(JSON.stringify({
        error: 'Request ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!rejectionReason) {
      return new Response(JSON.stringify({
        error: 'Rejection reason is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('❌ Admin rejecting bank details request:', requestId)

    // Get the request
    const request = await safeFindBankRequestById(req.payload, requestId)

    if (!request) {
      return new Response(JSON.stringify({
        error: 'Request not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((request as any).status !== 'pending') {
      return new Response(JSON.stringify({
        error: `Request has already been ${(request as any).status}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update request status to rejected
    const updatedRequest = await req.payload.update({
      collection: 'bank-details-requests',
      id: requestId,
      data: {
        status: 'rejected',
        rejectionReason,
        adminNotes: adminNotes || rejectionReason,
        processedAt: new Date().toISOString(),
        processedBy: user!.id
      }
    })

    console.log('❌ Bank details request rejected:', requestId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details request rejected. Driver has been notified.',
      request: {
        id: updatedRequest.id,
        status: (updatedRequest as any).status,
        rejectionReason: (updatedRequest as any).rejectionReason,
        processedAt: (updatedRequest as any).processedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Reject bank details request error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject bank details request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== GET BANK DETAILS REQUEST STATISTICS =====

export const getBankDetailsRequestStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Admin getting bank details request statistics')

    // Get all requests
    const allRequests = await req.payload.find({
      collection: 'bank-details-requests',
      limit: 1000 // High limit to get all
    })

    const total = allRequests.totalDocs
    const pending = allRequests.docs.filter((req: any) => req.status === 'pending').length
    const approved = allRequests.docs.filter((req: any) => req.status === 'approved').length
    const rejected = allRequests.docs.filter((req: any) => req.status === 'rejected').length

    // Get recent requests (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentRequests = await req.payload.find({
      collection: 'bank-details-requests',
      where: {
        requestedAt: {
          greater_than: sevenDaysAgo.toISOString()
        }
      },
      limit: 1000
    })

    return new Response(JSON.stringify({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        recentRequests: recentRequests.totalDocs,
        averageProcessingTime: 'N/A' // Can be calculated if needed
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get bank details request stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get bank details request statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


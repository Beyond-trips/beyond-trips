// endpoints/adminDriverEndpoints.ts
// Admin endpoints for driver registration approval workflow

import type { PayloadRequest } from 'payload'

// Helper function to check admin access
const checkAdminAccess = (user: any): boolean => {
  return user && (user.role === 'admin' || user.role === 'super-admin')
}

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
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// ===== DRIVER REGISTRATION APPROVAL =====

/**
 * Get all pending driver registrations
 * GET /api/admin/drivers?onboardingStatus=pending_review
 */
export const getPendingDriverRegistrations = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👨‍💼 Admin getting pending driver registrations')

    // Get URL parameters
    const url = new URL(req.url)
    const onboardingStatus = url.searchParams.get('onboardingStatus') || 'pending_review'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    // Get all onboarding records with specified status
    const onboardingRecords = await req.payload.find({
      collection: 'user-onboarding',
      where: {
        onboardingStatus: { equals: onboardingStatus }
      },
      limit,
      page,
      sort: '-createdAt'
    })

    // Get user details for each onboarding record
    const driversWithDetails = await Promise.all(
      onboardingRecords.docs.map(async (onboarding: any) => {
        const userId = typeof onboarding.userId === 'object' ? onboarding.userId.id : onboarding.userId
        
        // Get user info
        const userDoc = await req.payload.findByID({
          collection: 'users',
          id: userId
        })

        // Get documents
        const documents = await req.payload.find({
          collection: 'user-documents',
          where: { userId: { equals: userId } },
          limit: 10
        })

        // Get bank details
        const bankDetails = await req.payload.find({
          collection: 'user-bank-details',
          where: { userId: { equals: userId } },
          limit: 1
        })

        return {
          userId: userId,
          email: userDoc.email,
          firstName: userDoc.firstName,
          lastName: userDoc.lastName,
          phoneNumber: userDoc.phoneNumber,
          onboarding: {
            id: onboarding.id,
            currentStep: onboarding.currentStep,
            onboardingStatus: onboarding.onboardingStatus,
            stepsCompleted: onboarding.stepsCompleted,
            startedAt: onboarding.startedAt,
            completedAt: onboarding.completedAt,
            notes: onboarding.notes
          },
          documents: documents.docs,
          bankDetails: bankDetails.docs[0] || null,
          submittedAt: onboarding.completedAt || onboarding.updatedAt
        }
      })
    )

    return new Response(JSON.stringify({
      success: true,
      drivers: driversWithDetails,
      pagination: {
        page: onboardingRecords.page,
        limit: onboardingRecords.limit,
        totalPages: onboardingRecords.totalPages,
        totalDocs: onboardingRecords.totalDocs,
        hasNextPage: onboardingRecords.hasNextPage,
        hasPrevPage: onboardingRecords.hasPrevPage
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error getting pending driver registrations:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get pending registrations',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Approve driver registration
 * POST /api/admin/drivers/:userId/approve-registration
 */
export const approveDriverRegistration = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get userId from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const userIdIndex = pathParts.indexOf('drivers') + 1
    const userId = pathParts[userIdIndex]

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'User ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Admin approving driver registration for user:', userId)

    // Get the onboarding record
    const onboardingRecords = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: userId } },
      limit: 1
    })

    if (onboardingRecords.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Onboarding record not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const onboardingRecord = onboardingRecords.docs[0]

    // Update onboarding status to approved
    const updatedOnboarding = await req.payload.update({
      collection: 'user-onboarding',
      id: onboardingRecord.id,
      data: {
        onboardingStatus: 'approved',
        approvedAt: new Date().toISOString(),
        rejectionReason: null // Clear any previous rejection reason
      }
    })

    // Update user status to active
    await req.payload.update({
      collection: 'users',
      id: userId,
      data: {
        status: 'active'
      }
    })

    // TODO: Send approval notification to driver
    // This should integrate with your notification system
    console.log('📧 TODO: Send approval notification to driver:', userId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Driver registration approved successfully',
      onboarding: updatedOnboarding
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error approving driver registration:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve registration',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Reject driver registration
 * POST /api/admin/drivers/:userId/reject-registration
 * Body: { reason: string }
 */
export const rejectDriverRegistration = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get userId from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const userIdIndex = pathParts.indexOf('drivers') + 1
    const userId = pathParts[userIdIndex]

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'User ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse request body to get rejection reason
    const body = await parseRequestBody(req)
    const rejectionReason = body.reason || 'Registration did not meet requirements'

    console.log('❌ Admin rejecting driver registration for user:', userId)
    console.log('   Reason:', rejectionReason)

    // Get the onboarding record
    const onboardingRecords = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: userId } },
      limit: 1
    })

    if (onboardingRecords.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Onboarding record not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const onboardingRecord = onboardingRecords.docs[0]

    // Update onboarding status to rejected
    const updatedOnboarding = await req.payload.update({
      collection: 'user-onboarding',
      id: onboardingRecord.id,
      data: {
        onboardingStatus: 'rejected',
        rejectionReason: rejectionReason
      }
    })

    // Update user status to inactive
    await req.payload.update({
      collection: 'users',
      id: userId,
      data: {
        status: 'inactive'
      }
    })

    // TODO: Send rejection notification to driver with reason
    // This should integrate with your notification system
    console.log('📧 TODO: Send rejection notification to driver:', userId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Driver registration rejected',
      onboarding: updatedOnboarding
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error rejecting driver registration:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject registration',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


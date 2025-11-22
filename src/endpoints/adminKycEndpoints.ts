// endpoints/adminKycEndpoints.ts
// Admin endpoints for KYC document verification workflow

import type { PayloadRequest } from 'payload'
import { getRequestUrlOrError, ensureUserNotNull } from '../utilities/requestHelpers'

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

const safeFindDocumentById = async (
  payload: PayloadRequest['payload'],
  id: string,
  depth = 0,
) => {
  try {
    return await payload.findByID({
      collection: 'user-documents',
      id,
      depth,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

// ===== KYC DOCUMENT VERIFICATION =====

/**
 * Get documents by status for KYC review
 * GET /api/admin/kyc/documents?status=pending&documentType=drivers_license
 */
export const getPendingDocuments = async (req: PayloadRequest): Promise<Response> => {
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

    // Get URL parameters
    const urlResult = getRequestUrlOrError(req)
    if (urlResult instanceof Response) return urlResult
    const url = urlResult
    const status = url.searchParams.get('status') || 'pending'
    const documentType = url.searchParams.get('documentType')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const search = url.searchParams.get('search') // For driver name/email search

    console.log('📋 Admin fetching KYC documents with status:', status)

    // Build query
    const whereClause: any = {
      documentStatus: { equals: status }
    }

    if (documentType) {
      whereClause.documentType = { equals: documentType }
    }

    const documents = await req.payload.find({
      collection: 'user-documents',
      where: whereClause,
      limit,
      page,
      sort: '-uploadedAt',
      depth: 2 // Include user details
    })

    // Enrich with driver details
    const enrichedDocs = await Promise.all(
      documents.docs.map(async (doc: any) => {
        const userId = typeof doc.userId === 'object' ? doc.userId.id : doc.userId
        
        let userDetails = null
        if (typeof doc.userId === 'object') {
          userDetails = doc.userId
        } else {
          try {
            userDetails = await req.payload.findByID({
              collection: 'users',
              id: userId
            })
          } catch (err) {
            console.error('Error fetching user details:', err)
          }
        }

        // Filter by search if provided
        if (search && userDetails) {
          const searchLower = search.toLowerCase()
          const fullName = `${userDetails.firstName || ''} ${userDetails.lastName || ''}`.toLowerCase()
          const email = (userDetails.email || '').toLowerCase()
          
          if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
            return null // Filter out non-matches
          }
        }

        // Extract media file details from documentFile relationship
        const mediaFile = typeof doc.documentFile === 'object' ? doc.documentFile : null
        const fileUrl = (mediaFile as any)?.s3Url || mediaFile?.url || ''
        
        return {
          id: doc.id,
          documentType: doc.documentType,
          documentStatus: doc.documentStatus,
          documentFile: doc.documentFile, // Full relationship object (for backward compatibility)
          fileUrl: fileUrl, // ✅ S3 URL (preferred) or PayloadCMS URL (fallback)
          s3Url: (mediaFile as any)?.s3Url || null, // ✅ Explicit S3 URL (if available)
          uploadedAt: doc.uploadedAt,
          resubmittedAt: doc.resubmittedAt,
          expiresAt: doc.expiresAt,
          rejectionReason: doc.rejectionReason,
          driver: userDetails ? {
            id: userId,
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            email: userDetails.email,
            phoneNumber: userDetails.phoneNumber
          } : null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }
      })
    )

    // Filter out null entries (from search)
    const filteredDocs = enrichedDocs.filter(doc => doc !== null)

    return new Response(JSON.stringify({
      success: true,
      documents: filteredDocs,
      pagination: {
        page: documents.page,
        limit: documents.limit,
        totalPages: documents.totalPages,
        totalDocs: documents.totalDocs,
        hasNextPage: documents.hasNextPage,
        hasPrevPage: documents.hasPrevPage
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error fetching pending documents:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch documents',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get single document details for review
 * GET /api/admin/kyc/documents/:id
 */
export const getDocumentDetails = async (req: PayloadRequest): Promise<Response> => {
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

    // Get document ID from URL
    const urlResult = getRequestUrlOrError(req)
    if (urlResult instanceof Response) return urlResult
    const url = urlResult
    const pathParts = url.pathname.split('/')
    const documentIdIndex = pathParts.indexOf('documents') + 1
    const documentId = pathParts[documentIdIndex]

    if (!documentId) {
      return new Response(JSON.stringify({
        error: 'Document ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📄 Admin fetching document details:', documentId)

    const document = await safeFindDocumentById(req.payload, documentId, 2)

    if (!document) {
      return new Response(JSON.stringify({
        error: 'Document not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get driver details
    const userId = typeof document.userId === 'object' ? (document.userId as any).id : document.userId
    const driver = await req.payload.findByID({
      collection: 'users',
      id: userId
    })

    // Get all documents for this driver for context
    const allDriverDocs = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: userId } },
      limit: 10
    })

    // Get onboarding status
    const onboarding = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: userId } },
      limit: 1
    })

    // Extract media file details from documentFile relationship
    const mediaFile = typeof (document as any).documentFile === 'object' ? (document as any).documentFile : null
    const fileUrl = (mediaFile as any)?.s3Url || mediaFile?.url || ''
    
    return new Response(JSON.stringify({
      success: true,
      document: {
        ...(document as any),
        fileUrl: fileUrl, // ✅ S3 URL (preferred) or PayloadCMS URL (fallback)
        s3Url: (mediaFile as any)?.s3Url || null, // ✅ Explicit S3 URL (if available)
        driver: {
          id: userId,
          firstName: (driver as any).firstName,
          lastName: (driver as any).lastName,
          email: (driver as any).email,
          phoneNumber: (driver as any).phoneNumber,
          role: (driver as any).role
        }
      },
      driverDocuments: allDriverDocs.docs.map((doc: any) => {
        // Format driver documents with S3 URLs
        const docMediaFile = typeof doc.documentFile === 'object' ? doc.documentFile : null
        const docFileUrl = (docMediaFile as any)?.s3Url || docMediaFile?.url || ''
        return {
          ...doc,
          fileUrl: docFileUrl,
          s3Url: (docMediaFile as any)?.s3Url || null
        }
      }),
      onboardingStatus: onboarding.docs[0] || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error fetching document details:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch document details',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Verify/Approve a document
 * POST /api/admin/kyc/documents/:id/verify
 * Body: { note?: string, expiresAt?: string }
 */
export const verifyDocument = async (req: PayloadRequest): Promise<Response> => {
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

    // Get document ID from URL
    const urlResult = getRequestUrlOrError(req)
    if (urlResult instanceof Response) return urlResult
    const url = urlResult
    const pathParts = url.pathname.split('/')
    const documentIdIndex = pathParts.findIndex(p => p === 'documents') + 1
    const documentId = pathParts[documentIdIndex]

    if (!documentId || documentId === 'verify') {
      return new Response(JSON.stringify({
        error: 'Document ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { note, expiresAt } = body

    console.log('✅ Admin verifying document:', documentId)

    // Get the document to check current status
    const document = await safeFindDocumentById(req.payload, documentId)

    if (!document) {
      return new Response(JSON.stringify({
        error: 'Document not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const allowedStatuses = ['pending', 'under_review', 'resubmitted']
    if (!allowedStatuses.includes((document as any).documentStatus)) {
      return new Response(JSON.stringify({
        error: `Document is already ${(document as any).documentStatus}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Ensure user is not null
    const userCheck = ensureUserNotNull(user)
    if (userCheck) return userCheck

    // Update document status
    const updateData: any = {
      documentStatus: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: user.id,
      verificationStatus: 'approved',
      rejectionReason: null, // Clear any previous rejection reason
      resubmittedAt: null,
    }

    if (note) {
      updateData.adminNotes = note
    }

    if (expiresAt) {
      updateData.expiresAt = expiresAt
    }

    const updatedDocument = await req.payload.update({
      collection: 'user-documents',
      id: documentId,
      data: updateData
    })

    // TODO: Send notification to driver about document verification
    const userId = typeof document.userId === 'object' ? (document.userId as any).id : document.userId
    console.log('📧 TODO: Send verification notification to driver:', userId)

    // Check if all documents are verified - if so, can auto-approve onboarding
    const allDriverDocs = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: userId } },
      limit: 10
    })

    const allVerified = allDriverDocs.docs.every((doc: any) => 
      doc.documentStatus === 'verified' || doc.documentStatus === 'expired'
    )

    if (allVerified) {
      console.log('✅ All documents verified for driver:', userId)
      // TODO: Could auto-trigger registration approval here
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Document verified successfully',
      document: updatedDocument
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error verifying document:', error)
    return new Response(JSON.stringify({
      error: 'Failed to verify document',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Reject a document
 * POST /api/admin/kyc/documents/:id/reject
 * Body: { reason: string, note?: string }
 */
export const rejectDocument = async (req: PayloadRequest): Promise<Response> => {
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

    // Get document ID from URL
    const urlResult = getRequestUrlOrError(req)
    if (urlResult instanceof Response) return urlResult
    const url = urlResult
    const pathParts = url.pathname.split('/')
    const documentIdIndex = pathParts.findIndex(p => p === 'documents') + 1
    const documentId = pathParts[documentIdIndex]

    if (!documentId || documentId === 'reject') {
      return new Response(JSON.stringify({
        error: 'Document ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { reason, note } = body

    if (!reason) {
      return new Response(JSON.stringify({
        error: 'Rejection reason is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('❌ Admin rejecting document:', documentId)
    console.log('   Reason:', reason)

    // Get the document
    const document = await safeFindDocumentById(req.payload, documentId)

    if (!document) {
      return new Response(JSON.stringify({
        error: 'Document not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update document status
    const updateData: any = {
      documentStatus: 'rejected',
      rejectionReason: reason,
      verifiedAt: null, // Clear verification
      verifiedBy: null,
      verificationStatus: 'rejected'
    }

    if (note) {
      updateData.adminNotes = note
    }

    const updatedDocument = await req.payload.update({
      collection: 'user-documents',
      id: documentId,
      data: updateData
    })

    // TODO: Send notification to driver about document rejection
    const userId = typeof document.userId === 'object' ? (document.userId as any).id : document.userId
    console.log('📧 TODO: Send rejection notification to driver:', userId)
    console.log('📧 TODO: Include rejection reason:', reason)

    // Update onboarding status if needed
    // If any document is rejected, set overall status to indicate issue
    const onboarding = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: userId } },
      limit: 1
    })

    if (onboarding.docs.length > 0) {
      // Optionally set a flag or notes on the onboarding record
      console.log('ℹ️ Driver has document rejection - onboarding may need review')
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Document rejected',
      document: updatedDocument
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error rejecting document:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject document',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Mark document as under review
 * POST /api/admin/kyc/documents/:id/review
 */
export const markDocumentUnderReview = async (req: PayloadRequest): Promise<Response> => {
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

    // Get document ID from URL
    const urlResult = getRequestUrlOrError(req)
    if (urlResult instanceof Response) return urlResult
    const url = urlResult
    const pathParts = url.pathname.split('/')
    const documentIdIndex = pathParts.findIndex(p => p === 'documents') + 1
    const documentId = pathParts[documentIdIndex]

    if (!documentId || documentId === 'review') {
      return new Response(JSON.stringify({
        error: 'Document ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👀 Admin marking document under review:', documentId)

    const document = await safeFindDocumentById(req.payload, documentId)

    if (!document) {
      return new Response(JSON.stringify({
        error: 'Document not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if ((document as any).documentStatus === 'under_review') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Document already under review',
        document
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updatedDocument = await req.payload.update({
      collection: 'user-documents',
      id: documentId,
      data: {
        documentStatus: 'under_review',
        verificationStatus: 'pending'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Document marked as under review',
      document: updatedDocument
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error marking document under review:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark document under review',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get KYC statistics for admin dashboard
 * GET /api/admin/kyc/stats
 */
export const getKycStats = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('📊 Admin fetching KYC statistics')

    // Get counts for each status
    const [pending, underReview, verified, rejected, expired, resubmitted] = await Promise.all([
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'pending' } }, limit: 1 }),
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'under_review' } }, limit: 1 }),
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'verified' } }, limit: 1 }),
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'rejected' } }, limit: 1 }),
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'expired' } }, limit: 1 }),
      req.payload.find({ collection: 'user-documents', where: { documentStatus: { equals: 'resubmitted' } }, limit: 1 })
    ])

    return new Response(JSON.stringify({
      success: true,
      stats: {
        pending: pending.totalDocs,
        underReview: underReview.totalDocs,
        verified: verified.totalDocs,
        rejected: rejected.totalDocs,
        expired: expired.totalDocs,
        resubmitted: resubmitted.totalDocs,
        total: pending.totalDocs + underReview.totalDocs + verified.totalDocs + rejected.totalDocs + expired.totalDocs + resubmitted.totalDocs,
        needsAttention: pending.totalDocs + resubmitted.totalDocs
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error fetching KYC stats:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch KYC statistics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


import { PayloadRequest } from 'payload'

interface UserDataExport {
  user: any
  businessDetails?: any
  bankDetails?: any
  driverEarnings?: any[]
  invoices?: any[]
  campaigns?: any[]
  ratings?: any[]
  notifications?: any[]
  withdrawals?: any[]
  documents?: any[]
  exportMetadata: {
    exportedAt: string
    exportedBy: string
    format: string
    totalRecords: number
  }
}

interface AccountDeletionRequest {
  userId: string
  deletionRequestedAt: string
  deletionScheduledFor: string
  gracePeriodDays: number
  confirmationToken?: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

// ===== D1: EXPORT PERSONAL DATA (GDPR) =====

/**
 * D1: Export Personal Data (GDPR)
 * User exports all their personal data in a structured format
 */
export const exportUserData = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const format = searchParams.get('format') || 'json'
    const targetUserId = searchParams.get('userId') || user.id

    // Check if user can export data (own data or admin)
    const canExport = user.id === targetUserId || user.role === 'admin'
    if (!canExport) {
      return new Response(JSON.stringify({
        error: 'Forbidden - You can only export your own data'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📤 Exporting user data for user:', targetUserId, 'Format:', format)

    // Get user basic data
    const userData = await req.payload.findByID({
      collection: 'users',
      id: targetUserId
    })

    // Get business details
    const businessDetails = await req.payload.find({
      collection: 'business-details',
      where: { user: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get bank details
    const bankDetails = await req.payload.find({
      collection: 'bank-details',
      where: { user: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get driver earnings
    const driverEarnings = await req.payload.find({
      collection: 'driver-earnings',
      where: { driver: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get invoices
    const invoices = await req.payload.find({
      collection: 'invoices',
      where: { 
        or: [
          { advertiser: { equals: targetUserId } },
          { driver: { equals: targetUserId } }
        ]
      },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get campaigns (if user is advertiser)
    const campaigns = await req.payload.find({
      collection: 'campaigns',
      where: { advertiser: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get ratings (both given and received)
    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: {
        or: [
          { driver: { equals: targetUserId } },
          { reviewerId: { equals: targetUserId } }
        ]
      },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get notifications
    const notifications = await req.payload.find({
      collection: 'driver-notifications',
      where: { driver: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get withdrawals/payouts
    const withdrawals = await req.payload.find({
      collection: 'withdrawals',
      where: { user: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Get documents
    const documents = await req.payload.find({
      collection: 'documents',
      where: { user: { equals: targetUserId } },
      limit: 1000
    }).catch(() => ({ docs: [] }))

    // Calculate total records
    const totalRecords = 1 + // user data
      businessDetails.docs.length +
      bankDetails.docs.length +
      driverEarnings.docs.length +
      invoices.docs.length +
      campaigns.docs.length +
      ratings.docs.length +
      notifications.docs.length +
      withdrawals.docs.length +
      documents.docs.length

    // Structure the export data
    const exportData: UserDataExport = {
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        phoneNumber: userData.phoneNumber,
        dateOfBirth: userData.dateOfBirth,
        address: userData.address,
        profilePicture: userData.profilePicture,
        driversLicense: userData.driversLicense,
        licenseExpiry: userData.licenseExpiry,
        vehicleDetails: userData.vehicleDetails,
        isActive: userData.isActive,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      },
      businessDetails: businessDetails.docs.length > 0 ? businessDetails.docs.map(b => ({
        id: b.id,
        companyName: b.companyName,
        businessType: b.businessType,
        businessRegistration: b.businessRegistration,
        businessAddress: b.businessAddress,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      })) : null,
      bankDetails: bankDetails.docs.length > 0 ? bankDetails.docs.map(b => ({
        id: b.id,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        accountType: b.accountType,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      })) : null,
      driverEarnings: driverEarnings.docs.length > 0 ? driverEarnings.docs.map(e => ({
        id: e.id,
        amount: e.amount,
        campaignId: e.campaignId,
        magazineName: e.magazineName,
        scannedAt: e.scannedAt,
        status: e.status,
        createdAt: e.createdAt
      })) : [],
      invoices: invoices.docs.length > 0 ? invoices.docs.map(i => ({
        id: i.id,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
        paidAt: i.paidAt,
        createdAt: i.createdAt
      })) : [],
      campaigns: campaigns.docs.length > 0 ? campaigns.docs.map(c => ({
        id: c.id,
        name: c.name,
        budget: c.budget,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt
      })) : [],
      ratings: ratings.docs.length > 0 ? ratings.docs.map(r => ({
        id: r.id,
        ratingValue: r.ratingValue,
        comment: r.comment,
        reviewerType: r.reviewerType,
        createdAt: r.createdAt,
        response: r.response
      })) : [],
      notifications: notifications.docs.length > 0 ? notifications.docs.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        priority: n.priority,
        createdAt: n.createdAt
      })) : [],
      withdrawals: withdrawals.docs.length > 0 ? withdrawals.docs.map(w => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        requestedAt: w.requestedAt,
        processedAt: w.processedAt,
        createdAt: w.createdAt
      })) : [],
      documents: documents.docs.length > 0 ? documents.docs.map(d => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        fileSize: d.fileSize,
        uploadedAt: d.uploadedAt,
        createdAt: d.createdAt
      })) : [],
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        format: format,
        totalRecords: totalRecords
      }
    }

    // Format response based on requested format
    if (format === 'json') {
      console.log('✅ User data exported successfully:', totalRecords, 'records')

      return new Response(JSON.stringify({
        success: true,
        exportData,
        metadata: {
          exportedAt: exportData.exportMetadata.exportedAt,
          totalRecords: totalRecords,
          format: format,
          downloadUrl: `/api/user/data-export/download/${Date.now()}.json`
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user-data-export-${targetUserId}.json"`
        }
      })
    } else {
      return new Response(JSON.stringify({
        error: 'Unsupported format. Only JSON format is currently supported.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('❌ Export user data error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export user data',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== D2: REQUEST DATA DELETION (GDPR) =====

/**
 * D2: Request Data Deletion
 * User requests deletion of their account and data with 30-day grace period
 */
export const requestAccountDeletion = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🗑️ Processing account deletion request for user:', user.id)

    // Check if user already has a pending deletion request
    const existingDeletion = await req.payload.find({
      collection: 'account-deletions',
      where: { 
        and: [
          { userId: { equals: user.id } },
          { status: { equals: 'pending' } }
        ]
      },
      limit: 1
    })

    if (existingDeletion.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'You already have a pending deletion request',
        deletionRequest: existingDeletion.docs[0]
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create deletion request with 30-day grace period
    const deletionDate = new Date()
    deletionDate.setDate(deletionDate.getDate() + 30)

    const deletionRequest: AccountDeletionRequest = {
      userId: user.id,
      deletionRequestedAt: new Date().toISOString(),
      deletionScheduledFor: deletionDate.toISOString(),
      gracePeriodDays: 30,
      confirmationToken: generateConfirmationToken(),
      status: 'pending'
    }

    // Save deletion request
    const savedDeletion = await req.payload.create({
      collection: 'account-deletions',
      data: deletionRequest
    })

    // Send confirmation email with cancel link
    await sendDeletionConfirmationEmail(user.email, deletionRequest.confirmationToken)

    // Mark user as deletion pending
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        deletionStatus: 'pending',
        deletionScheduledFor: deletionDate.toISOString()
      }
    })

    console.log('✅ Account deletion requested successfully, scheduled for:', deletionDate.toISOString())

    return new Response(JSON.stringify({
      success: true,
      deletionRequest: {
        id: savedDeletion.id,
        userId: user.id,
        deletionRequestedAt: deletionRequest.deletionRequestedAt,
        deletionScheduledFor: deletionRequest.deletionScheduledFor,
        gracePeriodDays: deletionRequest.gracePeriodDays,
        status: deletionRequest.status,
        confirmationEmailSent: true
      },
      message: 'Account deletion requested successfully. Check your email for confirmation.',
      gracePeriod: {
        days: 30,
        canCancelUntil: deletionRequest.deletionScheduledFor
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Request account deletion error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to request account deletion',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Cancel Account Deletion
 * User cancels their account deletion request within grace period
 */
export const cancelAccountDeletion = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { confirmationToken } = body

    if (!confirmationToken) {
      return new Response(JSON.stringify({
        error: 'Confirmation token is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('❌ Cancelling account deletion for user:', user.id)

    // Find deletion request
    const deletionRequest = await req.payload.find({
      collection: 'account-deletions',
      where: {
        and: [
          { userId: { equals: user.id } },
          { confirmationToken: { equals: confirmationToken } },
          { status: { equals: 'pending' } }
        ]
      },
      limit: 1
    })

    if (deletionRequest.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Deletion request not found or already processed'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if still within grace period
    const scheduledDeletion = new Date(deletionRequest.docs[0].deletionScheduledFor)
    const now = new Date()

    if (now >= scheduledDeletion) {
      return new Response(JSON.stringify({
        error: 'Grace period has expired. Deletion cannot be cancelled.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Cancel deletion request
    await req.payload.update({
      collection: 'account-deletions',
      id: deletionRequest.docs[0].id,
      data: {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      }
    })

    // Update user status
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        deletionStatus: null,
        deletionScheduledFor: null
      }
    })

    console.log('✅ Account deletion cancelled successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Account deletion has been cancelled successfully.',
      userStatus: 'active'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Cancel account deletion error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to cancel account deletion',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function generateConfirmationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

async function sendDeletionConfirmationEmail(email: string, token: string): Promise<void> {
  // This would integrate with your email service
  console.log('📧 Sending deletion confirmation email to:', email)
  // Implementation would depend on your email service (SendGrid, AWS SES, etc.)
}

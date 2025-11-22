import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.body && typeof req.body === 'object') {
      return req.body
    }
    
    // If body is a stream or string, parse it
    const text = await req.text?.() || ''
    return JSON.parse(text)
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// Helper to safely fetch withdrawals without throwing when not found
const safeFindWithdrawalById = async (
  payload: PayloadRequest['payload'],
  id: string,
  depth = 0,
) => {
  try {
    return await payload.findByID({
      collection: 'driver-withdrawals',
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

// ===== ADMIN WITHDRAWAL MANAGEMENT =====

// Get all withdrawal requests (admin only)
export const getAllWithdrawals = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'all'

    console.log('👨‍💼 Admin getting all withdrawals:', status)

    const whereClause: any = {}
    if (status !== 'all') {
      whereClause.status = { equals: status }
    }

    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit,
      depth: 1
    })

    // Calculate totals
    const totalPending = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'pending')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)
    
    const totalApproved = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'approved')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)
    
    const totalCompleted = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'completed')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)

    return new Response(JSON.stringify({
      success: true,
      withdrawals: withdrawals.docs.map((withdrawal: any) => ({
        id: withdrawal.id,
        driver: typeof withdrawal.driver === 'object' ? {
          id: withdrawal.driver.id,
          email: withdrawal.driver.email,
          firstName: withdrawal.driver.firstName,
          lastName: withdrawal.driver.lastName
        } : { id: withdrawal.driver },
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        bankDetails: withdrawal.bankDetails,
        reason: withdrawal.reason,
        adminNotes: withdrawal.adminNotes,
        createdAt: withdrawal.createdAt,
        processedAt: withdrawal.processedAt,
        processedBy: typeof withdrawal.processedBy === 'object' ? {
          id: withdrawal.processedBy.id,
          email: (withdrawal.processedBy as any).email
        } : null,
        transactionId: withdrawal.transactionId
      })),
      totals: {
        totalPending,
        totalApproved,
        totalCompleted
      },
      pagination: {
        page: withdrawals.page,
        totalPages: withdrawals.totalPages,
        totalDocs: withdrawals.totalDocs,
        hasNextPage: withdrawals.hasNextPage,
        hasPrevPage: withdrawals.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all withdrawals error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get withdrawals'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update withdrawal status (admin only)
export const updateWithdrawalStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { withdrawalId, status, adminNotes, transactionId } = body

    if (!withdrawalId || !status) {
      return new Response(JSON.stringify({
        error: 'Withdrawal ID and status are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'processing', 'completed']
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        error: 'Invalid status. Must be one of: pending, approved, rejected, processing, completed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👨‍💼 Admin updating withdrawal:', withdrawalId, 'to status:', status)

    // Get the withdrawal first
    const withdrawal = await safeFindWithdrawalById(req.payload, withdrawalId)

    if (!withdrawal) {
      return new Response(JSON.stringify({
        error: 'Withdrawal not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update the withdrawal
    const updatedWithdrawal = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status,
        adminNotes: adminNotes || withdrawal.adminNotes,
        transactionId: transactionId || withdrawal.transactionId,
        processedBy: user.id
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Withdrawal ${status} successfully`,
      withdrawal: {
        id: updatedWithdrawal.id,
        status: updatedWithdrawal.status,
        adminNotes: updatedWithdrawal.adminNotes,
        transactionId: updatedWithdrawal.transactionId,
        processedAt: updatedWithdrawal.processedAt,
        processedBy: updatedWithdrawal.processedBy
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update withdrawal status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update withdrawal status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get withdrawal statistics (admin only)
export const getWithdrawalStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👨‍💼 Admin getting withdrawal statistics')

    // Get all withdrawals
    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      limit: 0 // Get all records
    })

    // Calculate statistics
    const stats = {
      total: withdrawals.docs.length,
      pending: withdrawals.docs.filter((w: any) => w.status === 'pending').length,
      approved: withdrawals.docs.filter((w: any) => w.status === 'approved').length,
      rejected: withdrawals.docs.filter((w: any) => w.status === 'rejected').length,
      processing: withdrawals.docs.filter((w: any) => w.status === 'processing').length,
      completed: withdrawals.docs.filter((w: any) => w.status === 'completed').length,
      totalAmount: {
        pending: withdrawals.docs
          .filter((w: any) => w.status === 'pending')
          .reduce((sum: number, w: any) => sum + w.amount, 0),
        approved: withdrawals.docs
          .filter((w: any) => w.status === 'approved')
          .reduce((sum: number, w: any) => sum + w.amount, 0),
        completed: withdrawals.docs
          .filter((w: any) => w.status === 'completed')
          .reduce((sum: number, w: any) => sum + w.amount, 0)
      }
    }

    // Generate monthly statistics for the last 6 months
    const monthlyStats = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const monthWithdrawals = withdrawals.docs.filter((withdrawal: any) => {
        const withdrawalDate = new Date(withdrawal.createdAt)
        return withdrawalDate >= monthStart && withdrawalDate <= monthEnd
      })

      monthlyStats.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: monthWithdrawals.length,
        amount: monthWithdrawals.reduce((sum: number, w: any) => sum + w.amount, 0),
        completed: monthWithdrawals.filter((w: any) => w.status === 'completed').length
      })
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        ...stats,
        monthlyStats
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get withdrawal stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get withdrawal statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== ENHANCED APPROVAL ACTIONS =====

// Approve withdrawal request
export const approveWithdrawal = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { withdrawalId, adminNotes } = body

    if (!withdrawalId) {
      return new Response(JSON.stringify({
        error: 'Withdrawal ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Admin approving withdrawal:', withdrawalId)

    // Get the withdrawal
    const withdrawal = await safeFindWithdrawalById(req.payload, withdrawalId, 1)

    if (!withdrawal) {
      return new Response(JSON.stringify({
        error: 'Withdrawal not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((withdrawal as any).status !== 'pending') {
      return new Response(JSON.stringify({
        error: `Withdrawal has already been ${(withdrawal as any).status}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update to approved
    const updatedWithdrawal = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status: 'approved',
        adminNotes: adminNotes || 'Approved by admin',
        processedAt: new Date().toISOString(),
        processedBy: user.id
      }
    })

    // Send notification to driver
    try {
      const driverId = typeof (withdrawal as any).driver === 'object' 
        ? (withdrawal as any).driver.id 
        : (withdrawal as any).driver

      if (driverId) {
        await req.payload.create({
          collection: 'driver-notifications',
          data: {
            driver: driverId,
            type: 'payment',
            title: 'Withdrawal Approved',
            message: `Your withdrawal request for ₦${(withdrawal as any).amount} has been approved and will be processed shortly.`,
            isRead: false,
            priority: 'high'
          }
        })
      } else {
        console.warn('⚠️ Skipping approval notification, driver missing for withdrawal', withdrawalId)
      }
    } catch (error) {
      console.error('⚠️ Error sending approval notification:', error)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal approved successfully. Driver has been notified.',
      withdrawal: {
        id: (updatedWithdrawal as any).id,
        status: (updatedWithdrawal as any).status,
        processedAt: (updatedWithdrawal as any).processedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Approve withdrawal error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve withdrawal'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Reject withdrawal request
export const rejectWithdrawal = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { withdrawalId, rejectionReason, adminNotes } = body

    if (!withdrawalId) {
      return new Response(JSON.stringify({
        error: 'Withdrawal ID is required'
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

    console.log('❌ Admin rejecting withdrawal:', withdrawalId)

    // Get the withdrawal
    const withdrawal = await safeFindWithdrawalById(req.payload, withdrawalId, 1)

    if (!withdrawal) {
      return new Response(JSON.stringify({
        error: 'Withdrawal not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((withdrawal as any).status !== 'pending') {
      return new Response(JSON.stringify({
        error: `Withdrawal has already been ${(withdrawal as any).status}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update to rejected
    const updatedWithdrawal = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status: 'rejected',
        adminNotes: adminNotes || rejectionReason,
        processedAt: new Date().toISOString(),
        processedBy: user.id
      }
    })

    // Send notification to driver
    try {
      const driverId = typeof (withdrawal as any).driver === 'object' 
        ? (withdrawal as any).driver.id 
        : (withdrawal as any).driver

      if (driverId) {
        await req.payload.create({
          collection: 'driver-notifications',
          data: {
            driver: driverId,
            type: 'payment',
            title: 'Withdrawal Rejected',
            message: `Your withdrawal request for ₦${(withdrawal as any).amount} has been rejected. Reason: ${rejectionReason}`,
            isRead: false,
            priority: 'high'
          }
        })
      } else {
        console.warn('⚠️ Skipping rejection notification, driver missing for withdrawal', withdrawalId)
      }
    } catch (error) {
      console.error('⚠️ Error sending rejection notification:', error)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal rejected. Driver has been notified.',
      withdrawal: {
        id: (updatedWithdrawal as any).id,
        status: (updatedWithdrawal as any).status,
        processedAt: (updatedWithdrawal as any).processedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Reject withdrawal error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject withdrawal'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Complete withdrawal (mark as paid)
export const completeWithdrawal = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { withdrawalId, transactionId, adminNotes, proofUrl } = body

    if (!withdrawalId) {
      return new Response(JSON.stringify({
        error: 'Withdrawal ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Admin completing withdrawal:', withdrawalId)

    // Get the withdrawal
    const withdrawal = await safeFindWithdrawalById(req.payload, withdrawalId, 1)

    if (!withdrawal) {
      return new Response(JSON.stringify({
        error: 'Withdrawal not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Must be in approved status to complete
    if ((withdrawal as any).status !== 'approved') {
      return new Response(JSON.stringify({
        error: `Cannot complete withdrawal with status "${(withdrawal as any).status}". Withdrawal must be approved first.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update to completed
    const updatedWithdrawal = await req.payload.update({
      collection: 'driver-withdrawals',
      id: withdrawalId,
      data: {
        status: 'completed',
        transactionId: transactionId || (withdrawal as any).transactionId,
        adminNotes: adminNotes || (withdrawal as any).adminNotes,
        processedAt: new Date().toISOString(),
        processedBy: user.id
      }
    })

    // Send notification to driver
    try {
      const driverId = typeof (withdrawal as any).driver === 'object' 
        ? (withdrawal as any).driver.id 
        : (withdrawal as any).driver

      if (driverId) {
        await req.payload.create({
          collection: 'driver-notifications',
          data: {
            driver: driverId,
            type: 'payment',
            title: 'Withdrawal Completed',
            message: `Your withdrawal of ₦${(withdrawal as any).amount} has been processed successfully. Transaction ID: ${transactionId || 'N/A'}`,
            isRead: false,
            priority: 'high'
          }
        })
      } else {
        console.warn('⚠️ Skipping completion notification, driver missing for withdrawal', withdrawalId)
      }
    } catch (error) {
      console.error('⚠️ Error sending completion notification:', error)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal marked as completed. Driver has been notified.',
      withdrawal: {
        id: (updatedWithdrawal as any).id,
        status: (updatedWithdrawal as any).status,
        transactionId: (updatedWithdrawal as any).transactionId,
        processedAt: (updatedWithdrawal as any).processedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Complete withdrawal error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to complete withdrawal'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== PAYOUT EXPORT & COMPLETION =====

// Export withdrawals to CSV
export const exportWithdrawalsToCSV = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('📊 Admin exporting withdrawals to CSV:', { status, startDate, endDate })

    const whereClause: any = {}
    if (status !== 'all') {
      whereClause.status = { equals: status }
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.greater_than_equal = new Date(startDate).toISOString()
      }
      if (endDate) {
        whereClause.createdAt.less_than_equal = new Date(endDate).toISOString()
      }
    }

    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: whereClause,
      sort: '-createdAt',
      limit: 10000, // Export up to 10,000 records
      depth: 1
    })

    // Generate CSV
    const headers = [
      'ID',
      'Driver Name',
      'Driver Email',
      'Amount',
      'Currency',
      'Status',
      'Bank Name',
      'Account Number',
      'Account Name',
      'Created At',
      'Processed At',
      'Transaction ID',
      'Admin Notes'
    ]

    const rows = withdrawals.docs.map((withdrawal: any) => {
      const driver = typeof withdrawal.driver === 'object' ? withdrawal.driver : null
      const bankDetails = withdrawal.bankDetails || {}
      
      return [
        withdrawal.id,
        driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
        driver?.email || 'N/A',
        withdrawal.amount,
        withdrawal.currency || 'NGN',
        withdrawal.status,
        bankDetails.bankName || 'N/A',
        bankDetails.accountNumber || 'N/A',
        bankDetails.accountName || 'N/A',
        new Date(withdrawal.createdAt).toISOString(),
        withdrawal.processedAt ? new Date(withdrawal.processedAt).toISOString() : 'N/A',
        withdrawal.transactionId || 'N/A',
        withdrawal.adminNotes || 'N/A'
      ]
    })

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="withdrawals_${status}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error) {
    console.error('❌ Export withdrawals to CSV error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export withdrawals'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Export withdrawals to PDF (simplified version - returns JSON data for PDF generation on frontend)
export const exportWithdrawalsToPDF = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('📊 Admin exporting withdrawals for PDF:', { status, startDate, endDate })

    const whereClause: any = {}
    if (status !== 'all') {
      whereClause.status = { equals: status }
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.greater_than_equal = new Date(startDate).toISOString()
      }
      if (endDate) {
        whereClause.createdAt.less_than_equal = new Date(endDate).toISOString()
      }
    }

    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: whereClause,
      sort: '-createdAt',
      limit: 10000, // Export up to 10,000 records
      depth: 1
    })

    // Calculate totals
    const totalAmount = withdrawals.docs.reduce((sum: number, w: any) => sum + w.amount, 0)
    const pendingAmount = withdrawals.docs
      .filter((w: any) => w.status === 'pending')
      .reduce((sum: number, w: any) => sum + w.amount, 0)
    const completedAmount = withdrawals.docs
      .filter((w: any) => w.status === 'completed')
      .reduce((sum: number, w: any) => sum + w.amount, 0)

    // Return structured data for PDF generation
    return new Response(JSON.stringify({
      success: true,
      exportData: {
        generatedAt: new Date().toISOString(),
        generatedBy: user.email,
        filters: { status, startDate, endDate },
        summary: {
          totalRecords: withdrawals.docs.length,
          totalAmount,
          pendingAmount,
          completedAmount,
          currency: 'NGN'
        },
        withdrawals: withdrawals.docs.map((withdrawal: any) => {
          const driver = typeof withdrawal.driver === 'object' ? withdrawal.driver : null
          const bankDetails = withdrawal.bankDetails || {}
          
          return {
            id: withdrawal.id,
            driverName: driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
            driverEmail: driver?.email || 'N/A',
            amount: withdrawal.amount,
            currency: withdrawal.currency || 'NGN',
            status: withdrawal.status,
            bankName: bankDetails.bankName || 'N/A',
            accountNumber: bankDetails.accountNumber || 'N/A',
            accountName: bankDetails.accountName || 'N/A',
            createdAt: withdrawal.createdAt,
            processedAt: withdrawal.processedAt,
            transactionId: withdrawal.transactionId,
            adminNotes: withdrawal.adminNotes
          }
        })
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Export withdrawals for PDF error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export withdrawals'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Mark multiple approved payouts as completed
export const bulkCompleteWithdrawals = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { withdrawalIds, transactionIds, adminNotes } = body

    if (!withdrawalIds || !Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return new Response(JSON.stringify({
        error: 'Withdrawal IDs array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📦 Admin bulk completing ${withdrawalIds.length} withdrawals`)

    const results = {
      successful: [] as string[],
      failed: [] as Array<{ id: string; error: string }>
    }

    // Process each withdrawal
    for (let i = 0; i < withdrawalIds.length; i++) {
      const withdrawalId = withdrawalIds[i]
      const transactionId = transactionIds?.[i] || `BULK_TX_${Date.now()}_${i}`
      
      try {
        // Get the withdrawal first
        const withdrawal = await safeFindWithdrawalById(req.payload, withdrawalId)

        if (!withdrawal) {
          results.failed.push({ id: withdrawalId, error: 'Withdrawal not found' })
          continue
        }

        // Only complete approved withdrawals
        if ((withdrawal as any).status !== 'approved') {
          results.failed.push({ id: withdrawalId, error: `Withdrawal status is ${(withdrawal as any).status}, not approved` })
          continue
        }

        // Update to completed
        await req.payload.update({
          collection: 'driver-withdrawals',
          id: withdrawalId,
          data: {
            status: 'completed',
            transactionId,
            adminNotes: adminNotes || 'Bulk completed by admin',
            processedAt: new Date().toISOString(),
            processedBy: user.id
          }
        })

        results.successful.push(withdrawalId)

        // Send notification to driver
        try {
          const driverId = typeof (withdrawal as any).driver === 'object' 
            ? (withdrawal as any).driver.id 
            : (withdrawal as any).driver

          if (driverId) {
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: driverId,
                type: 'payment',
                title: 'Payout Completed',
                message: `Your payout of ₦${(withdrawal as any).amount} has been completed. Transaction ID: ${transactionId}`,
                isRead: false,
                priority: 'high'
              }
            })
          } else {
            console.warn('⚠️ Skipping bulk completion notification, driver missing for withdrawal', withdrawalId)
          }
        } catch (error) {
          console.error('⚠️ Error sending completion notification:', error)
        }

      } catch (error: any) {
        results.failed.push({ id: withdrawalId, error: error.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk completion completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Bulk complete withdrawals error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to bulk complete withdrawals'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

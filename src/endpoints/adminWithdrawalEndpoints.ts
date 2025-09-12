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
      withdrawals: {
        totalPending,
        totalApproved,
        totalCompleted,
        requests: withdrawals.docs.map((withdrawal: any) => ({
          id: withdrawal.id,
          driver: {
            id: withdrawal.driver.id,
            email: withdrawal.driver.email,
            firstName: withdrawal.driver.firstName,
            lastName: withdrawal.driver.lastName
          },
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          status: withdrawal.status,
          bankDetails: withdrawal.bankDetails,
          reason: withdrawal.reason,
          adminNotes: withdrawal.adminNotes,
          createdAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt,
          processedBy: withdrawal.processedBy ? {
            id: withdrawal.processedBy.id,
            email: withdrawal.processedBy.email
          } : null,
          transactionId: withdrawal.transactionId
        }))
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
    const withdrawal = await req.payload.findByID({
      collection: 'driver-withdrawals',
      id: withdrawalId
    })

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

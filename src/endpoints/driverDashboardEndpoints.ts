// endpoints/driverDashboardEndpoints.ts

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

// ===== DRIVER DASHBOARD OVERVIEW =====

// Get driver dashboard overview
export const getDriverDashboardOverview = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🚗 Getting driver dashboard overview for:', user.id)

    // Get user onboarding status
    const onboarding = await req.payload.find({
      collection: 'user-onboarding',
      where: { userId: { equals: user.id } },
      limit: 1
    })

    // Get user documents
    const documents = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: user.id } },
      limit: 10
    })

    // Get user bank details
    const bankDetails = await req.payload.find({
      collection: 'user-bank-details',
      where: { userId: { equals: user.id } },
      limit: 1
    })

    // Get user training
    const training = await req.payload.find({
      collection: 'user-training',
      where: { userId: { equals: user.id } },
      limit: 1
    })

    // Calculate completion percentage
    let completionPercentage = 0
    const totalSteps = 5
    let completedSteps = 0

    if (onboarding.docs.length > 0) completedSteps++
    if (documents.docs.length > 0) completedSteps++
    if (bankDetails.docs.length > 0) completedSteps++
    if (training.docs.length > 0) completedSteps++
    if (user.firstName && user.lastName) completedSteps++

    completionPercentage = Math.round((completedSteps / totalSteps) * 100)

    // Get driver's earnings
    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: {
        driver: { equals: user.id }
      }
    })

    const totalEarnings = earnings.docs.reduce((sum: number, earning: any) => sum + earning.amount, 0)
    const paidEarnings = earnings.docs
      .filter((earning: any) => earning.status === 'paid')
      .reduce((sum: number, earning: any) => sum + earning.amount, 0)
    const pendingEarnings = earnings.docs
      .filter((earning: any) => earning.status === 'pending')
      .reduce((sum: number, earning: any) => sum + earning.amount, 0)

    // Get driver's withdrawals
    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: {
        driver: { equals: user.id }
      }
    })

    const totalWithdrawn = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'completed')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)
    
    const pendingWithdrawals = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'pending')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)

    const availableBalance = paidEarnings - totalWithdrawn - pendingWithdrawals

    return new Response(JSON.stringify({
      success: true,
      overview: {
        completionPercentage,
        completedSteps,
        totalSteps,
        profileComplete: !!(user.firstName && user.lastName),
        documentsCount: documents.docs.length,
        hasBankDetails: bankDetails.docs.length > 0,
        hasTraining: training.docs.length > 0,
        onboardingStatus: onboarding.docs[0]?.onboardingStatus || 'in_progress',
        earnings: {
          total: totalEarnings,
          paid: paidEarnings,
          pending: pendingEarnings,
          availableBalance: availableBalance
        },
        withdrawals: {
          totalWithdrawn,
          pendingWithdrawals,
          availableBalance
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver dashboard overview error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get dashboard overview'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER EARNINGS =====

// Get driver earnings
export const getDriverEarnings = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const period = searchParams.get('period') || 'all' // all, month, week

    console.log('💰 Getting driver earnings for:', user.id)

    const whereClause: any = { driver: { equals: user.id } }
    
    // Add date filter based on period
    if (period === 'month') {
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      whereClause.createdAt = { greater_than: oneMonthAgo.toISOString() }
    } else if (period === 'week') {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      whereClause.createdAt = { greater_than: oneWeekAgo.toISOString() }
    }

    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit
    })

    // Calculate totals
    const totalScans = earnings.docs.reduce((sum: number, earning: any) => sum + (earning.scans || 0), 0)
    const totalPoints = earnings.docs.reduce((sum: number, earning: any) => sum + (earning.points || 0), 0)
    const totalEarnings = earnings.docs.reduce((sum: number, earning: any) => sum + earning.amount, 0)
    const paidEarnings = earnings.docs
      .filter((earning: any) => earning.status === 'paid')
      .reduce((sum: number, earning: any) => sum + earning.amount, 0)
    const pendingEarnings = earnings.docs
      .filter((earning: any) => earning.status === 'pending')
      .reduce((sum: number, earning: any) => sum + earning.amount, 0)

    // Generate 6-month history
    const sixMonthsHistory = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      
      const monthEarnings = earnings.docs.filter((earning: any) => {
        const earningDate = new Date(earning.createdAt)
        return earningDate >= monthStart && earningDate <= monthEnd
      })
      
      const monthScans = monthEarnings.reduce((sum: number, earning: any) => sum + (earning.scans || 0), 0)
      const monthPoints = monthEarnings.reduce((sum: number, earning: any) => sum + (earning.points || 0), 0)
      const monthTotal = monthEarnings.reduce((sum: number, earning: any) => sum + earning.amount, 0)
      
      sixMonthsHistory.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        scans: monthScans,
        points: monthPoints,
        amount: monthTotal,
        count: monthEarnings.length
      })
    }

    return new Response(JSON.stringify({
      success: true,
      earnings: {
        totalScans,
        totalPoints,
        total: totalEarnings,
        paid: paidEarnings,
        pending: pendingEarnings,
        exchangeRate: 500, // 500 Naira per point
        history: sixMonthsHistory,
        recent: earnings.docs.map((earning: any) => ({
          id: earning.id,
          scans: earning.scans || 0,
          points: earning.points || 0,
          amount: earning.amount,
          currency: earning.currency,
          type: earning.type,
          status: earning.status,
          description: earning.description,
          createdAt: earning.createdAt,
          paidAt: earning.paidAt
        }))
      },
      pagination: {
        page: earnings.page,
        totalPages: earnings.totalPages,
        totalDocs: earnings.totalDocs,
        hasNextPage: earnings.hasNextPage,
        hasPrevPage: earnings.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver earnings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver earnings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER RATINGS =====

// Get driver ratings
export const getDriverRatings = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('⭐ Getting driver ratings for:', user.id)

    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: { 
        driver: { equals: user.id },
        isPublic: { equals: true }
      },
      sort: '-createdAt',
      page,
      limit,
      depth: 1
    })

    // Calculate average rating
    const averageRating = ratings.docs.length > 0 
      ? ratings.docs.reduce((sum: number, rating: any) => sum + rating.rating, 0) / ratings.docs.length
      : 0

    // Calculate rating breakdown
    const ratingBreakdown = {
      5: ratings.docs.filter((r: any) => r.rating === 5).length,
      4: ratings.docs.filter((r: any) => r.rating === 4).length,
      3: ratings.docs.filter((r: any) => r.rating === 3).length,
      2: ratings.docs.filter((r: any) => r.rating === 2).length,
      1: ratings.docs.filter((r: any) => r.rating === 1).length,
    }

    return new Response(JSON.stringify({
      success: true,
      ratings: {
        average: Math.round(averageRating * 10) / 10,
        total: ratings.docs.length,
        breakdown: ratingBreakdown,
        recent: ratings.docs.map((rating: any) => ({
          id: rating.id,
          rating: rating.rating,
          review: rating.review,
          category: rating.category,
          isVerified: rating.isVerified,
          response: rating.response,
          createdAt: rating.createdAt,
          rater: rating.rater ? {
            firstName: rating.rater.firstName,
            lastName: rating.rater.lastName
          } : null
        }))
      },
      pagination: {
        page: ratings.page,
        totalPages: ratings.totalPages,
        totalDocs: ratings.totalDocs,
        hasNextPage: ratings.hasNextPage,
        hasPrevPage: ratings.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver ratings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver ratings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER NOTIFICATIONS =====

// Get driver notifications
export const getDriverNotifications = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    console.log('🔔 Getting driver notifications for:', user.id)

    const whereClause: any = { driver: { equals: user.id } }
    
    if (unreadOnly) {
      whereClause.isRead = { equals: false }
    }

    const notifications = await req.payload.find({
      collection: 'driver-notifications',
      where: whereClause,
      sort: '-createdAt',
      page,
      limit
    })

    return new Response(JSON.stringify({
      success: true,
      notifications: notifications.docs.map((notification: any) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        actionUrl: notification.actionUrl,
        priority: notification.priority,
        createdAt: notification.createdAt,
        expiresAt: notification.expiresAt
      })),
      pagination: {
        page: notifications.page,
        totalPages: notifications.totalPages,
        totalDocs: notifications.totalDocs,
        hasNextPage: notifications.hasNextPage,
        hasPrevPage: notifications.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver notifications'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Mark notification as read
export const markNotificationAsRead = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { notificationId } = body

    if (!notificationId) {
      return new Response(JSON.stringify({
        error: 'Notification ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Marking notification as read:', notificationId)

    const notification = await req.payload.update({
      collection: 'driver-notifications',
      id: notificationId,
      data: { isRead: true }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification marked as read',
      notification: {
        id: notification.id,
        isRead: notification.isRead
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Mark notification as read error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark notification as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER MAGAZINES =====

// Get driver magazines
export const getDriverMagazines = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const category = searchParams.get('category') || ''

    console.log('📚 Getting driver magazines for:', user.id)

    const whereClause: any = { isPublished: { equals: true } }
    
    if (category) {
      whereClause.category = { equals: category }
    }

    const magazines = await req.payload.find({
      collection: 'driver-magazines',
      where: whereClause,
      sort: '-publishedAt',
      page,
      limit
    })

    // Get read status for each magazine
    const magazineIds = magazines.docs.map((mag: any) => mag.id)
    const readStatuses = await req.payload.find({
      collection: 'driver-magazine-reads',
      where: { 
        driver: { equals: user.id },
        magazine: { in: magazineIds }
      }
    })

    const readStatusMap = new Map()
    readStatuses.docs.forEach((read: any) => {
      readStatusMap.set(read.magazine.id, {
        isRead: read.isRead,
        readAt: read.readAt,
        readProgress: read.readProgress
      })
    })

    return new Response(JSON.stringify({
      success: true,
      magazines: magazines.docs.map((magazine: any) => ({
        id: magazine.id,
        title: magazine.title,
        description: magazine.description,
        imageUrl: magazine.imageUrl,
        readTime: magazine.readTime,
        category: magazine.category,
        publishedAt: magazine.publishedAt,
        tags: magazine.tags,
        readStatus: readStatusMap.get(magazine.id) || {
          isRead: false,
          readAt: null,
          readProgress: 0
        }
      })),
      pagination: {
        page: magazines.page,
        totalPages: magazines.totalPages,
        totalDocs: magazines.totalDocs,
        hasNextPage: magazines.hasNextPage,
        hasPrevPage: magazines.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver magazines error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver magazines'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Mark magazine as read
export const markMagazineAsRead = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { magazineId, readProgress = 100 } = body

    if (!magazineId) {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📖 Marking magazine as read:', magazineId)

    // Check if read record already exists
    const existingRead = await req.payload.find({
      collection: 'driver-magazine-reads',
      where: { 
        driver: { equals: user.id },
        magazine: { equals: magazineId }
      },
      limit: 1
    })

    let readRecord
    if (existingRead.docs.length > 0) {
      // Update existing record
      readRecord = await req.payload.update({
        collection: 'driver-magazine-reads',
        id: existingRead.docs[0].id,
        data: { 
          isRead: true,
          readProgress: Math.min(readProgress, 100)
        }
      })
    } else {
      // Create new record
      readRecord = await req.payload.create({
        collection: 'driver-magazine-reads',
        data: {
          driver: user.id,
          magazine: magazineId,
          isRead: true,
          readProgress: Math.min(readProgress, 100)
        }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine marked as read',
      readRecord: {
        id: readRecord.id,
        isRead: readRecord.isRead,
        readProgress: readRecord.readProgress,
        readAt: readRecord.readAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Mark magazine as read error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark magazine as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER WITHDRAWALS =====

// Request withdrawal
export const requestWithdrawal = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { amount, bankDetails, reason } = body

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({
        error: 'Withdrawal amount must be greater than 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!bankDetails || !bankDetails.bankName || !bankDetails.accountName || !bankDetails.accountNumber) {
      return new Response(JSON.stringify({
        error: 'Bank details are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('💰 Driver requesting withdrawal:', user.id, 'amount:', amount)

    // Get driver's total earnings
    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: {
        driver: { equals: user.id }
      }
    })

    const totalEarnings = earnings.docs.reduce((sum: number, earning: any) => sum + earning.amount, 0)
    const paidEarnings = earnings.docs
      .filter((earning: any) => earning.status === 'paid')
      .reduce((sum: number, earning: any) => sum + earning.amount, 0)

    // Check if driver has enough earnings
    if (amount > paidEarnings) {
      return new Response(JSON.stringify({
        error: `Insufficient earnings. Available: ₦${paidEarnings}, Requested: ₦${amount}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check for pending withdrawals
    const pendingWithdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: {
        and: [
          { driver: { equals: user.id } },
          { status: { equals: 'pending' } }
        ]
      }
    })

    const pendingAmount = pendingWithdrawals.docs.reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)
    
    if (amount > (paidEarnings - pendingAmount)) {
      return new Response(JSON.stringify({
        error: `Insufficient available balance. Available: ₦${paidEarnings - pendingAmount}, Requested: ₦${amount}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create withdrawal request
    const withdrawal = await req.payload.create({
      collection: 'driver-withdrawals',
      data: {
        driver: user.id,
        amount: amount,
        currency: 'NGN',
        status: 'pending',
        bankDetails: {
          bankName: bankDetails.bankName,
          accountName: bankDetails.accountName,
          accountNumber: bankDetails.accountNumber
        },
        reason: reason || 'Withdrawal request'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        bankDetails: withdrawal.bankDetails,
        reason: withdrawal.reason,
        createdAt: withdrawal.createdAt
      },
      availableBalance: paidEarnings - pendingAmount - amount
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Request withdrawal error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit withdrawal request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get withdrawal history
export const getWithdrawalHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('💰 Getting withdrawal history for driver:', user.id)

    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: {
        driver: { equals: user.id }
      },
      sort: '-createdAt',
      page,
      limit
    })

    // Calculate totals
    const totalWithdrawn = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'completed')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)
    
    const pendingWithdrawals = withdrawals.docs
      .filter((withdrawal: any) => withdrawal.status === 'pending')
      .reduce((sum: number, withdrawal: any) => sum + withdrawal.amount, 0)

    return new Response(JSON.stringify({
      success: true,
      withdrawals: {
        totalWithdrawn,
        pendingWithdrawals,
        history: withdrawals.docs.map((withdrawal: any) => ({
          id: withdrawal.id,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          status: withdrawal.status,
          bankDetails: withdrawal.bankDetails,
          reason: withdrawal.reason,
          adminNotes: withdrawal.adminNotes,
          createdAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt,
          processedBy: withdrawal.processedBy
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
    console.error('❌ Get withdrawal history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get withdrawal history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER SCANS =====

// Add scans for driver
export const addDriverScans = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { scans, description } = body

    if (!scans || scans <= 0) {
      return new Response(JSON.stringify({
        error: 'Number of scans must be greater than 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📱 Adding scans for driver:', user.id, 'scans:', scans)

    // Create earnings record with automatic calculation
    const earning = await req.payload.create({
      collection: 'driver-earnings',
      data: {
        driver: user.id,
        scans: scans,
        points: scans, // 1 scan = 1 point
        amount: scans * 500, // 500 Naira per point
        type: 'scan_payment',
        status: 'pending',
        description: description || `Earned ${scans} points from ${scans} scans`,
        currency: 'NGN'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully added ${scans} scans`,
      earning: {
        id: earning.id,
        scans: earning.scans,
        points: earning.points,
        amount: earning.amount,
        currency: earning.currency,
        status: earning.status,
        description: earning.description,
        createdAt: earning.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Add driver scans error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add scans'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER PROFILE =====

// Get driver profile
export const getDriverProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👤 Getting driver profile for:', user.id)

    // Get user documents
    const documents = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: user.id } }
    })

    // Get user bank details
    const bankDetails = await req.payload.find({
      collection: 'user-bank-details',
      where: { userId: { equals: user.id } },
      limit: 1
    })

    // Get user training
    const training = await req.payload.find({
      collection: 'user-training',
      where: { userId: { equals: user.id } },
      limit: 1
    })

    return new Response(JSON.stringify({
      success: true,
      profile: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phoneNumber,
        profileComplete: !!(user.firstName && user.lastName),
        documents: documents.docs.map((doc: any) => ({
          id: doc.id,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          verificationStatus: doc.verificationStatus,
          uploadedAt: doc.createdAt
        })),
        bankDetails: bankDetails.docs.length > 0 ? {
          id: bankDetails.docs[0].id,
          bankName: bankDetails.docs[0].bankName,
          accountNumber: bankDetails.docs[0].accountNumber,
          accountName: bankDetails.docs[0].accountName
        } : null,
        training: training.docs.length > 0 ? {
          id: training.docs[0].id,
          trainingCompleted: training.docs[0].trainingCompleted,
          trainingCompletedAt: training.docs[0].trainingCompletedAt,
          termsAccepted: training.docs[0].termsAccepted
        } : null
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update driver profile
export const updateDriverProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { firstName, lastName, phoneNumber } = body

    if (!firstName || !lastName) {
      return new Response(JSON.stringify({
        error: 'First name and last name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✏️ Updating driver profile for:', user.id)

    const updatedUser = await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        firstName,
        lastName,
        phoneNumber
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phoneNumber
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update driver profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update driver profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

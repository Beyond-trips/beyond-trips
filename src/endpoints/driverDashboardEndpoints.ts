// endpoints/driverDashboardEndpoints.ts

import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    console.log('📝 parseRequestBody called')
    console.log('  - req.json type:', typeof req.json)
    console.log('  - req.body type:', typeof req.body)
    console.log('  - req.body instanceof ReadableStream:', req.body instanceof ReadableStream)
    
    if (req.json && typeof req.json === 'function') {
      const result = await req.json()
      console.log('  - Parsed from req.json():', result)
      return result
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      console.log('  - Using req.body directly:', req.body)
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
      const result = JSON.parse(bodyText)
      console.log('  - Parsed from ReadableStream:', result)
      return result
    }
    console.log('  - Returning req.body directly (last resort)')
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

    // ✅ CHECKPOINT: Access Control - Block access for pending/rejected drivers
    const onboardingRecord = onboarding.docs[0]
    if (onboardingRecord) {
      const status = onboardingRecord.onboardingStatus
      
      if (status === 'pending_review') {
        return new Response(JSON.stringify({
          error: 'Registration Pending Review',
          message: 'Your driver registration is currently under review by our admin team. You will be notified once approved.',
          onboardingStatus: status
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      if (status === 'rejected') {
        return new Response(JSON.stringify({
          error: 'Registration Rejected',
          message: onboardingRecord.rejectionReason || 'Your driver registration was not approved. Please contact support for more information.',
          onboardingStatus: status,
          rejectionReason: onboardingRecord.rejectionReason
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

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

    // Get driver's earnings (set high limit to get all earnings including recent BTL coins)
    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: {
        driver: { equals: user.id }
      },
      limit: 10000, // High limit to ensure we get all earnings
      sort: '-createdAt' // Most recent first
    })

    // ✅ Earnings Status Checkpoint
    // Calculate balance from all earnings (no 'pending' status filter)
    // Earnings are always 'active' until archived
    const totalEarnings = earnings.docs.reduce((sum: number, earning: any) => sum + earning.amount, 0)

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

    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals

    // Get driver's scans
    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: { driver: { equals: user.id } },
      limit: 1000,
      sort: '-createdAt'
    })

    const totalScans = scans.totalDocs
    const scanPoints = scans.docs.reduce((sum: number, scan: any) => sum + (scan.pointsEarned || 0), 0)
    
    // Also count BTL coin points from earnings (awards from rider reviews)
    const btlCoinPoints = earnings.docs.reduce((sum: number, earning: any) => 
      sum + (earning.source === 'btl_coin' ? (earning.points || 0) : 0), 0)
    
    const totalPoints = scanPoints + btlCoinPoints

    // Get driver's magazine pickups
    const magazinePickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: { driver: { equals: user.id } },
      limit: 100
    })

    const totalMagazinesCollected = magazinePickups.docs.reduce((sum: number, p: any) => 
      sum + (p.quantity || 1), 0)
    
    const activeMagazines = magazinePickups.docs.filter((p: any) => 
      p.status === 'picked-up' || p.status === 'active').length

    // Calculate monthly earnings for chart (last 6 months)
    const monthlyEarningsData: any = {}
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    earnings.docs.forEach((earning: any) => {
      const earnedDate = new Date(earning.createdAt)
      if (earnedDate >= sixMonthsAgo) {
        const monthKey = `${earnedDate.getFullYear()}-${String(earnedDate.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyEarningsData[monthKey]) {
          monthlyEarningsData[monthKey] = 0
        }
        monthlyEarningsData[monthKey] += earning.amount || 0
      }
    })

    const earningsChart = Object.entries(monthlyEarningsData)
      .map(([month, amount]) => ({
        month,
        amount
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Get next payout date (example: every 1st of month)
    const now = new Date()
    const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Get driver's ratings
    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: { driver: { equals: user.id } },
      limit: 100
    })

    const averageRating = ratings.totalDocs > 0
      ? ratings.docs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ratings.totalDocs
      : 0

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
        profile: {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          rating: averageRating.toFixed(1),
          totalReviews: ratings.totalDocs,
          status: (user as any).status || 'active'
        },
        metrics: {
          totalEarnings,
          availableBalance,
          totalScans,
          totalPoints,
          btlCoins: totalPoints,
          magazinesCollected: totalMagazinesCollected,
          activeMagazines
        },
        earnings: {
          total: totalEarnings,
          paid: totalWithdrawn,
          pending: pendingWithdrawals,
          availableBalance: availableBalance,
          nextPayoutDate: nextPayoutDate.toISOString(),
          earningsChart // Chart data for last 6 months
        },
        withdrawals: {
          totalWithdrawn,
          pendingWithdrawals,
          availableBalance,
          recentWithdrawals: withdrawals.docs.slice(0, 5).map((w: any) => ({
            id: w.id,
            amount: w.amount,
            status: w.status,
            requestedAt: w.createdAt,
            processedAt: w.processedAt
          }))
        },
        quickActions: {
          withdrawEarnings: availableBalance >= 50000, // Minimum withdrawal threshold (₦50,000)
          activateMagazine: true,
          updateProfile: completionPercentage < 100
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
        barcode: magazine.barcode || null,
        qrImageUrl: (magazine as any).qrImageUrl || null, // S3 URL (preferred)
        barcodeImage: magazine.barcodeImage || null, // Base64 (fallback)
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

    // Validate amount
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({
        error: 'Withdrawal amount must be greater than 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Bank Details Checkpoint
    // Query existing bank details from onboarding
    let existingBank = { docs: [] }
    try {
      existingBank = await req.payload.find({
        collection: 'user-bank-details',
        where: { userId: { equals: user.id } },
        limit: 1
      })
    } catch (error) {
      console.error('⚠️ Error querying existing bank details:', error)
      existingBank = { docs: [] }
    }

    // Determine which bank details to use
    let bankToUse = bankDetails

    // If new details not provided, use existing
    if (!bankDetails && existingBank.docs.length > 0) {
      bankToUse = {
        bankName: (existingBank.docs[0] as any).bankName,
        accountName: (existingBank.docs[0] as any).accountName,
        accountNumber: (existingBank.docs[0] as any).accountNumber
      }
    }

    // If neither provided and neither exists, reject
    if (!bankToUse) {
      return new Response(JSON.stringify({
        error: 'bank details are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate bankToUse has all required fields
    if (!bankToUse.bankName || !bankToUse.accountName || !bankToUse.accountNumber) {
      return new Response(JSON.stringify({
        error: 'bank details are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate account number format (10+ digits)
    if (!/^\d{10,}$/.test((bankToUse as any).accountNumber)) {
      return new Response(JSON.stringify({
        error: 'invalid account number format (must be 10+ digits)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If new bank details provided, save for future use
    if (bankDetails && (!existingBank.docs[0] || JSON.stringify(bankDetails) !== JSON.stringify({
      bankName: (existingBank.docs[0] as any)?.bankName,
      accountName: (existingBank.docs[0] as any)?.accountName,
      accountNumber: (existingBank.docs[0] as any)?.accountNumber
    }))) {
      try {
        if (existingBank.docs.length > 0) {
          // Update existing
          await req.payload.update({
            collection: 'user-bank-details',
            id: (existingBank.docs[0] as any).id,
            data: bankDetails
          })
        } else {
          // Create new
          await req.payload.create({
            collection: 'user-bank-details',
            data: {
              userId: user.id,
              ...bankDetails
            }
          } as any)
        }
      } catch (error) {
        console.error('⚠️ Failed to save bank details:', error)
        // Don't fail withdrawal if saving bank details fails
      }
    }

    // ✅ Balance Checkpoint - Real calculation
    // Get all earnings for this driver (no status filter - earnings are all active)
    let totalBalance = 0
    try {
      const earnings = await req.payload.find({
        collection: 'driver-earnings',
        where: { driver: { equals: user.id } }
      })
      totalBalance = earnings.docs.reduce((sum: number, e: any) => sum + e.amount, 0)
    } catch (error) {
      console.error('⚠️ Error querying earnings:', error)
      totalBalance = 0
    }

    // Get all pending/approved withdrawals (not completed or rejected)
    let totalPending = 0
    try {
      const pendingWithdrawals = await req.payload.find({
        collection: 'driver-withdrawals',
        where: {
          driver: { equals: user.id },
          status: { 
            not_in: ['completed', 'rejected']
          }
        }
      })
      totalPending = pendingWithdrawals.docs
        .reduce((sum: number, w: any) => sum + w.amount, 0)
    } catch (error) {
      console.error('⚠️ Error querying withdrawals:', error)
      totalPending = 0
    }

    // Calculate available balance
    const availableBalance = totalBalance - totalPending

    // Check minimum threshold (₦50,000)
    if (availableBalance < 50000) {
      const needed = 50000 - availableBalance
      return new Response(JSON.stringify({
        error: `Insufficient balance. You have ₦${availableBalance}. Need ₦${needed} more to reach ₦50,000 minimum`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if requesting more than available
    if (amount > availableBalance) {
      return new Response(JSON.stringify({
        error: `Cannot withdraw ₦${amount}. Your available balance is ₦${availableBalance}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Withdrawal Checkpoint - Real DB Record
    // Create real withdrawal record in database
    try {
      const withdrawal = await req.payload.create({
        collection: 'driver-withdrawals',
        data: {
          driver: user.id,
          amount: amount,
          bankDetails: bankToUse, // Use the validated bank details
          status: 'pending',
          currency: 'NGN'
        }
      } as any)

      // Send notification to driver
      try {
        await req.payload.create({
          collection: 'driver-notifications',
          data: {
            driver: user.id,
            type: 'withdrawal',
            title: 'Withdrawal Request Submitted',
            message: `Your withdrawal request for ₦${amount} has been submitted. Status: Pending Admin Review`,
            isRead: false,
            priority: 'high'
          }
        } as any)
      } catch (error) {
        console.error('⚠️ Failed to send notification:', error)
        // Don't fail the withdrawal if notification fails
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Withdrawal request submitted successfully',
        withdrawal: {
          id: (withdrawal as any).id,
          amount: (withdrawal as any).amount,
          status: (withdrawal as any).status,
          bankDetails: (withdrawal as any).bankDetails
        },
        availableBalance: availableBalance - amount
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('❌ Failed to create withdrawal:', error)
      return new Response(JSON.stringify({
        error: 'Failed to create withdrawal request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('❌ Request withdrawal error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit withdrawal request',
      details: error instanceof Error ? error.message : 'Unknown error'
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
        status: 'active', // Changed from 'pending' - earnings are always active
        description: description || `Earned ${scans} points from ${scans} scans`,
        currency: 'NGN'
      }
    } as any)

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

    // Get user documents with media relationship populated
    const documents = await req.payload.find({
      collection: 'user-documents',
      where: { userId: { equals: user.id } },
      depth: 2 // Populate nested relationships including documentFile -> media
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
        documents: documents.docs.map((doc: any) => {
          // Extract media file details from the documentFile relationship
          const mediaFile = typeof doc.documentFile === 'object' ? doc.documentFile : null
          
          // Prioritize S3 URL over PayloadCMS generated URL
          const fileUrl = (mediaFile as any)?.s3Url || mediaFile?.url || ''
          
          return {
            id: doc.id,
            type: doc.documentType, // ✅ FIXED: was doc.type, now doc.documentType
            fileName: mediaFile?.filename || 'Unknown', // ✅ FIXED: get from media relationship
            fileUrl: fileUrl, // ✅ S3 URL (preferred) or PayloadCMS URL (fallback)
            s3Url: (mediaFile as any)?.s3Url || null, // ✅ Explicit S3 URL (if available)
            verificationStatus: doc.documentStatus || doc.verificationStatus, // Use documentStatus (primary) or fallback to legacy verificationStatus
            uploadedAt: doc.uploadedAt || doc.createdAt,
            // Additional useful fields
            expiresAt: doc.expiresAt,
            verifiedAt: doc.verifiedAt,
            rejectionReason: doc.rejectionReason
          }
        }),
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

    const { firstName, lastName, phoneNumber, address } = body

    if (!firstName || !lastName) {
      return new Response(JSON.stringify({
        error: 'First name and last name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✏️ Updating driver profile for:', user.id)

    const updateData: any = {
      firstName,
      lastName
    }
    
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber
    if (address !== undefined) updateData.address = address

    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: updateData
    })

    // Fetch the updated user to ensure all fields are returned
    const updatedUser = await req.payload.findByID({
      collection: 'users',
      id: user.id
    })

    console.log('📋 Updated user data:', {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      address: (updatedUser as any).address,
      hasAddress: !!(updatedUser as any).address
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phoneNumber,
        address: (updatedUser as any).address || null
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

// ===== BANK DETAILS UPDATE REQUEST =====

// Request bank details update
export const requestBankDetailsUpdate = async (req: PayloadRequest): Promise<Response> => {
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

    const { newBankDetails, reason, bankName, accountName, accountNumber } = body

    // Support both nested (newBankDetails) and flat (bankName, accountName, accountNumber) formats
    let bankDetailsToUse: any = null
    
    if (newBankDetails && newBankDetails.bankName && newBankDetails.accountNumber && newBankDetails.accountName) {
      // Nested format
      bankDetailsToUse = newBankDetails
    } else if (bankName && accountNumber && accountName) {
      // Flat format - convert to nested
      bankDetailsToUse = {
        bankName,
        accountNumber,
        accountName
      }
    }

    // Validate required fields
    if (!bankDetailsToUse || !bankDetailsToUse.bankName || !bankDetailsToUse.accountNumber || !bankDetailsToUse.accountName) {
      return new Response(JSON.stringify({
        error: 'New bank details are required (bankName, accountNumber, accountName). You can send them as a nested object in "newBankDetails" or as flat fields in the request body.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!reason) {
      return new Response(JSON.stringify({
        error: 'reason for bank details update is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🏦 Driver requesting bank details update:', user.id)

    // Get current bank details
    const currentBankDetails = await req.payload.find({
      collection: 'user-bank-details',
      where: {
        userId: { equals: user.id }
      },
      limit: 1
    })

    let oldBankDetails
    if (currentBankDetails.docs.length > 0) {
      const current = currentBankDetails.docs[0]
      oldBankDetails = {
        bankName: current.bankName,
        accountNumber: current.accountNumber,
        accountName: current.accountName
      }
    } else {
      // No existing bank details
      oldBankDetails = {
        bankName: 'None',
        accountNumber: 'None',
        accountName: 'None'
      }
    }

    // Check for pending requests
    const pendingRequests = await req.payload.find({
      collection: 'bank-details-requests',
      where: {
        and: [
          { driver: { equals: user.id } },
          { status: { equals: 'pending' } }
        ]
      }
    })

    if (pendingRequests.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'You already have a pending bank details update request. Please wait for admin approval.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create bank details update request
    const request = await req.payload.create({
      collection: 'bank-details-requests',
      data: {
        driver: user.id,
        oldBankDetails,
        newBankDetails: {
          bankName: bankDetailsToUse.bankName,
          accountNumber: bankDetailsToUse.accountNumber,
          accountName: bankDetailsToUse.accountName
        },
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details update request submitted successfully. Please wait for admin approval.',
      request: {
        id: request.id,
        oldBankDetails,
        newBankDetails: newBankDetails,
        reason,
        status: 'pending',
        requestedAt: request.requestedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Request bank details update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit bank details update request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get bank details update requests
export const getBankDetailsRequests = async (req: PayloadRequest): Promise<Response> => {
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
    const status = searchParams.get('status') || '' // pending, approved, rejected

    console.log('🏦 Getting bank details requests for driver:', user.id)

    const whereClause: any = { driver: { equals: user.id } }
    
    if (status) {
      whereClause.status = { equals: status }
    }

    const requests = await req.payload.find({
      collection: 'bank-details-requests',
      where: whereClause,
      sort: '-requestedAt',
      page,
      limit
    })

    return new Response(JSON.stringify({
      success: true,
      requests: requests.docs.map((request: any) => ({
        id: request.id,
        oldBankDetails: request.oldBankDetails,
        newBankDetails: request.newBankDetails,
        reason: request.reason,
        status: request.status,
        rejectionReason: request.rejectionReason,
        requestedAt: request.requestedAt,
        processedAt: request.processedAt
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
    console.error('❌ Get bank details requests error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get bank details requests'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== MAGAZINE PICKUP SYSTEM =====

// Request magazine pickup
export const requestMagazinePickup = async (req: PayloadRequest): Promise<Response> => {
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

    const { magazineId, quantity, location, pickupDate, notes } = body

    // Validate required fields
    if (!magazineId) {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!location || !location.name || !location.address) {
      return new Response(JSON.stringify({
        error: 'Pickup location details are required (name, address)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Driver requesting magazine pickup:', user.id)

    // Check if magazine exists and is available
    const magazine = await req.payload.findByID({
      collection: 'driver-magazines',
      id: magazineId
    })

    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!(magazine as any).isPublished) {
      return new Response(JSON.stringify({
        error: 'Magazine is not available for pickup'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create magazine pickup request
    const pickup = await req.payload.create({
      collection: 'magazine-pickups',
      data: {
        driver: user.id,
        magazine: magazineId,
        quantity: quantity || 1,
        location: {
          name: location.name,
          address: location.address,
          contactPerson: location.contactPerson || '',
          contactPhone: location.contactPhone || ''
        },
        pickupDate: pickupDate || new Date().toISOString(),
        status: 'requested',
        notes: notes || '',
        requestedAt: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine pickup request submitted successfully. Please wait for admin approval.',
      pickup: {
        id: pickup.id,
        magazine: (magazine as any).title,
        quantity: (pickup as any).quantity,
        location: (pickup as any).location,
        status: 'requested',
        requestedAt: (pickup as any).requestedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Request magazine pickup error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit magazine pickup request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get magazine pickup history
export const getMagazinePickups = async (req: PayloadRequest): Promise<Response> => {
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
    const status = searchParams.get('status') || '' // requested, approved, picked-up, returned

    console.log('📚 Getting magazine pickups for driver:', user.id)

    const whereClause: any = { driver: { equals: user.id } }
    
    if (status) {
      whereClause.status = { equals: status }
    }

    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: whereClause,
      sort: '-requestedAt',
      page,
      limit,
      depth: 2 // Include magazine details
    })

    return new Response(JSON.stringify({
      success: true,
      pickups: pickups.docs.map((pickup: any) => ({
        id: pickup.id,
        magazine: {
          id: typeof pickup.magazine === 'object' ? pickup.magazine.id : pickup.magazine,
          title: typeof pickup.magazine === 'object' ? pickup.magazine.title : '',
          imageUrl: typeof pickup.magazine === 'object' ? pickup.magazine.imageUrl : '',
          barcode: typeof pickup.magazine === 'object' ? (pickup.magazine.barcode || null) : null,
          qrImageUrl: typeof pickup.magazine === 'object' ? ((pickup.magazine as any).qrImageUrl || null) : null, // S3 URL (preferred)
          barcodeImage: typeof pickup.magazine === 'object' ? (pickup.magazine.barcodeImage || null) : null // Base64 (fallback)
        },
        quantity: pickup.quantity,
        location: pickup.location,
        pickupDate: pickup.pickupDate,
        returnDate: pickup.returnDate,
        actualReturnDate: pickup.actualReturnDate,
        status: pickup.status,
        qrCode: pickup.qrCode,
        verificationCode: pickup.verificationCode,
        notes: pickup.notes,
        requestedAt: pickup.requestedAt,
        approvedAt: pickup.approvedAt,
        pickedUpAt: pickup.pickedUpAt
      })),
      pagination: {
        page: pickups.page,
        totalPages: pickups.totalPages,
        totalDocs: pickups.totalDocs,
        hasNextPage: pickups.hasNextPage,
        hasPrevPage: pickups.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get magazine pickups error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine pickups'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Confirm magazine return
export const confirmMagazineReturn = async (req: PayloadRequest): Promise<Response> => {
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

    const { pickupId, condition, notes } = body

    if (!pickupId) {
      return new Response(JSON.stringify({
        error: 'Pickup ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Driver confirming magazine return:', pickupId)

    // Get the pickup - handle case where pickup doesn't exist
    let pickup
    try {
      pickup = await req.payload.findByID({
        collection: 'magazine-pickups',
        id: pickupId
      })
    } catch (error) {
      // If pickup not found, return 404 instead of 500
      return new Response(JSON.stringify({
        error: 'Pickup not found',
        details: 'The specified magazine pickup does not exist'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!pickup) {
      return new Response(JSON.stringify({
        error: 'Pickup not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify driver owns this pickup
    const driverId = typeof (pickup as any).driver === 'object' ? (pickup as any).driver.id : (pickup as any).driver
    if (driverId !== user.id) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - This pickup belongs to another driver'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if pickup is in picked-up status
    if ((pickup as any).status !== 'picked-up') {
      return new Response(JSON.stringify({
        error: 'Can only return magazines that have been picked up'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update pickup status to returned
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: condition === 'damaged' ? 'damaged' : 'returned',
        notes: notes ? `${(pickup as any).notes}\n\nReturn notes: ${notes}` : (pickup as any).notes,
        actualReturnDate: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine return confirmed. Thank you!',
      pickup: {
        id: updatedPickup.id,
        status: (updatedPickup as any).status,
        actualReturnDate: (updatedPickup as any).actualReturnDate
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Confirm magazine return error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to confirm magazine return'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== NOTIFICATION PREFERENCES =====

// Get notification preferences
export const getNotificationPreferences = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('🔔 Getting notification preferences for user:', user.id)

    // Get user with notification preferences
    const userWithPrefs = await req.payload.findByID({
      collection: 'users',
      id: user.id
    })

    const preferences = (userWithPrefs as any).notificationPreferences || {
      email_enabled: true,
      sms_enabled: false,
      in_app_enabled: true,
      notification_types: ['payment', 'campaign', 'magazine', 'system']
    }

    return new Response(JSON.stringify({
      success: true,
      preferences
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get notification preferences error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get notification preferences'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update notification preferences
export const updateNotificationPreferences = async (req: PayloadRequest): Promise<Response> => {
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

    const { email_enabled, sms_enabled, in_app_enabled, notification_types } = body

    console.log('🔔 Updating notification preferences for user:', user.id)

    // Build preferences object
    const preferences: any = {}
    
    if (email_enabled !== undefined) {
      preferences.email_enabled = email_enabled
    }
    
    if (sms_enabled !== undefined) {
      preferences.sms_enabled = sms_enabled
    }
    
    if (in_app_enabled !== undefined) {
      preferences.in_app_enabled = in_app_enabled
    }
    
    if (notification_types !== undefined) {
      // Validate notification types
      const validTypes = ['payment', 'campaign', 'magazine', 'system']
      const invalidTypes = notification_types.filter((type: string) => !validTypes.includes(type))
      
      if (invalidTypes.length > 0) {
        return new Response(JSON.stringify({
          error: `Invalid notification types: ${invalidTypes.join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      preferences.notification_types = notification_types
    }

    // Update user notification preferences
    const updatedUser = await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        notificationPreferences: preferences
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: (updatedUser as any).notificationPreferences
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update notification preferences error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update notification preferences'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== PASSWORD MANAGEMENT =====

// Change password
export const changePassword = async (req: PayloadRequest): Promise<Response> => {
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

    const { currentPassword, newPassword, confirmPassword } = body

    // Validation
    if (!currentPassword) {
      return new Response(JSON.stringify({
        error: 'current password is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!newPassword) {
      return new Response(JSON.stringify({
        error: 'new password is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!confirmPassword) {
      return new Response(JSON.stringify({
        error: 'password confirmation is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({
        error: 'new password and confirmation do not match'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({
        error: 'password must be at least 8 characters long'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!/[A-Z]/.test(newPassword)) {
      return new Response(JSON.stringify({
        error: 'password must contain at least one uppercase letter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!/[a-z]/.test(newPassword)) {
      return new Response(JSON.stringify({
        error: 'password must contain at least one lowercase letter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!/[0-9]/.test(newPassword)) {
      return new Response(JSON.stringify({
        error: 'password must contain at least one number'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!/[!@#$%^&*]/.test(newPassword)) {
      return new Response(JSON.stringify({
        error: 'password must contain at least one special character (!@#$%^&*)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔐 Changing password for user:', user.id)

    // Get user to verify current password
    const userRecord = await req.payload.findByID({
      collection: 'users',
      id: user.id
    })

    if (!userRecord) {
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify current password using Payload's authentication
    try {
      await req.payload.auth({
        req: req as any,
        email: (userRecord as any).email,
        password: currentPassword
      })
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'current password is incorrect'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update password
    try {
      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: {
          password: newPassword
        }
      })
    } catch (e) {
      console.error('Error updating password:', e)
      return new Response(JSON.stringify({
        error: 'Failed to update password'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Password changed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Change password error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to change password',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== BARCODE SCANNING =====

// Scan magazine barcode and create earnings
export const scanMagazineBarcode = async (req: PayloadRequest): Promise<Response> => {
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

    const { barcode, ipAddress, deviceId } = body
    const scannedAt = new Date()

    // Validate barcode input
    if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid barcode - barcode must be a non-empty string'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📱 Scanning barcode:', barcode, 'for driver:', user.id)

    // ✅ Barcode Checkpoint 1: Find magazine by barcode
    let magazine: any = null
    try {
      const magazineSearch = await req.payload.find({
        collection: 'driver-magazines',
        where: { barcode: { equals: barcode } },
        limit: 1
      })
      if (magazineSearch.docs.length > 0) {
        magazine = magazineSearch.docs[0]
      }
    } catch (error) {
      console.error('⚠️ Error searching for magazine by barcode:', error)
    }

    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine not found - invalid barcode'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Barcode Checkpoint 2: Check for duplicate scans (same driver + magazine)
    let existingScan: any = null
    try {
      const scanSearch = await req.payload.find({
        collection: 'driver-scans',
        where: {
          driver: { equals: user.id },
          magazine: { equals: magazine.id },
          status: { equals: 'valid' }
        },
        limit: 1
      })
      if (scanSearch.docs.length > 0) {
        existingScan = scanSearch.docs[0]
      }
    } catch (error) {
      console.error('⚠️ Error checking for duplicate scans:', error)
    }

    // ✅ Barcode Checkpoint 3: Time-based fraud prevention (5-second rule)
    // Check if driver has scanned ANY magazine in the last 5 seconds
    let recentScans: any[] = []
    try {
      const fiveSecondsAgo = new Date(scannedAt.getTime() - 5000)
      const recentScansSearch = await req.payload.find({
        collection: 'driver-scans',
        where: {
          driver: { equals: user.id },
          scannedAt: { greater_than_equal: fiveSecondsAgo.toISOString() },
          status: { equals: 'valid' }
        }
      })
      recentScans = recentScansSearch.docs || []
    } catch (error) {
      console.error('⚠️ Error checking recent scans:', error)
    }

    // Determine scan status and reason
    let scanStatus = 'valid'
    let scanReason = ''

    if (existingScan) {
      scanStatus = 'duplicate'
      scanReason = `Duplicate scan detected. This magazine was already scanned at ${existingScan.scannedAt}`
      console.log('⚠️ Duplicate scan detected for driver:', user.id, 'magazine:', magazine.id)
    } else if (recentScans.length > 0) {
      scanStatus = 'suspicious'
      scanReason = `Suspicious activity: ${recentScans.length} scans in the last 5 seconds`
      console.log('⚠️ Suspicious scan pattern detected for driver:', user.id)
    }

    // ✅ Barcode Checkpoint 4: Create audit record
    let scanRecord: any = null
    try {
      scanRecord = await req.payload.create({
        collection: 'driver-scans',
        data: {
          driver: user.id,
          magazine: magazine.id,
          barcode: barcode,
          scannedAt: scannedAt.toISOString(),
          ipAddress: ipAddress || 'unknown',
          deviceId: deviceId || 'unknown',
          status: scanStatus,
          reason: scanReason || undefined
        }
      } as any)
      console.log('✅ Scan record created:', scanRecord.id, 'Status:', scanStatus)
    } catch (error) {
      console.error('❌ Error creating scan record:', error)
      return new Response(JSON.stringify({
        error: 'Failed to record scan',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If duplicate or suspicious, reject immediately with audit trail created
    if (scanStatus === 'duplicate') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Scan rejected - duplicate scan detected',
        reason: scanReason,
        scanId: scanRecord.id,
        status: scanStatus
      }), {
        status: 409, // Conflict - duplicate
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (scanStatus === 'suspicious') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Scan rejected - suspicious activity detected',
        reason: scanReason,
        scanId: scanRecord.id,
        status: scanStatus
      }), {
        status: 429, // Too many requests
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Barcode Checkpoint 5: Valid scan - Create earnings record
    let earning: any = null
    try {
      earning = await req.payload.create({
        collection: 'driver-earnings',
        data: {
          driver: user.id,
          scans: 1,
          points: 1, // 1 scan = 1 point
          amount: 500, // 500 Naira per scan
          type: 'barcode_scan',
          status: 'active',
          description: `Earned ₦500 from scanning magazine: ${magazine.title}`,
          currency: 'NGN'
        }
      } as any)
      console.log('✅ Earnings created:', earning.id, 'Amount: ₦500')
    } catch (error) {
      console.error('❌ Error creating earnings:', error)
      // Still return success for scan, but note earning creation failed
      return new Response(JSON.stringify({
        success: true,
        message: 'Scan recorded but earnings creation failed',
        scanId: scanRecord.id,
        magazine: {
          id: magazine.id,
          title: magazine.title
        },
        warning: 'Please contact support - earnings may need manual adjustment'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Barcode Checkpoint 6: Update scan record with earnings reference
    try {
      await req.payload.update({
        collection: 'driver-scans',
        id: scanRecord.id,
        data: {
          earnings: earning.id
        }
      })
    } catch (error) {
      console.error('⚠️ Error updating scan record with earnings reference:', error)
      // Don't fail the entire operation if this update fails
    }

    // ✅ Barcode Checkpoint 7: Send success notification
    try {
      await req.payload.create({
        collection: 'driver-notifications',
        data: {
          driver: user.id,
          type: 'earnings',
          title: 'Magazine Scan Successful! 🎉',
          message: `You earned ₦500 by scanning "${magazine.title}". Total balance updated!`,
          isRead: false,
          priority: 'normal'
        }
      } as any)
    } catch (error) {
      console.error('⚠️ Failed to send notification:', error)
      // Don't fail if notification fails
    }

    // Return success
    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine scan successful! You earned ₦500.',
      scan: {
        id: scanRecord.id,
        barcode: barcode,
        scannedAt: scannedAt.toISOString(),
        status: scanStatus
      },
      earnings: {
        id: earning.id,
        amount: 500,
        currency: 'NGN',
        points: 1
      },
      magazine: {
        id: magazine.id,
        title: magazine.title
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Scan magazine barcode error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process barcode scan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER REQUEST HISTORY =====

// Get driver's own request history (withdrawals, bank updates, magazine returns)
export const getDriverRequestHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user || !user.id) {
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
    const requestType = searchParams.get('type') || 'all' // all, withdrawal, bank_update, magazine_return
    const statusFilter = searchParams.get('status') || ''

    console.log(`📋 Driver ${user.id} fetching request history. Type: ${requestType}, Status: ${statusFilter}`)

    const allRequests: any[] = []

    // 1. Fetch withdrawal requests
    if (requestType === 'all' || requestType === 'withdrawal') {
      const withdrawalWhere: any = {
        driver: { equals: user.id }
      }
      if (statusFilter) {
        withdrawalWhere.status = { equals: statusFilter }
      }

      const withdrawals = await req.payload.find({
        collection: 'driver-withdrawals',
        where: withdrawalWhere,
        sort: '-createdAt',
        limit: limit * 2,
        depth: 0
      })

      withdrawals.docs.forEach((withdrawal: any) => {
        allRequests.push({
          id: withdrawal.id,
          type: 'withdrawal',
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
      const bankUpdateWhere: any = {
        userId: { equals: user.id }
      }
      if (statusFilter) {
        bankUpdateWhere.status = { equals: statusFilter }
      }

      const bankUpdates = await req.payload.find({
        collection: 'bank-details-requests',
        where: bankUpdateWhere,
        sort: '-createdAt',
        limit: limit * 2,
        depth: 0
      })

      bankUpdates.docs.forEach((bankUpdate: any) => {
        allRequests.push({
          id: bankUpdate.id,
          type: 'bank_update',
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
        driver: { equals: user.id },
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
        depth: 1
      })

      magazineReturns.docs.forEach((magazineReturn: any) => {
        allRequests.push({
          id: magazineReturn.id,
          type: 'magazine_return',
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
    console.error('❌ Get driver request history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get request history',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER EARNINGS ANALYTICS =====

/**
 * B7: Search/Filter Earnings History
 * Driver can search and filter their earnings by date range, type, status
 */
export const searchDriverEarnings = async (req: PayloadRequest): Promise<Response> => {
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') // 'scan', 'bonus', 'referral', etc.
    const status = searchParams.get('status') // 'pending', 'paid', 'cancelled'
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('🔍 Searching driver earnings:', { startDate, endDate, type, status, minAmount, maxAmount })

    const whereConditions: any[] = [{ driver: { equals: user.id } }]

    if (startDate) {
      whereConditions.push({ createdAt: { greater_than_equal: new Date(startDate).toISOString() } })
    }

    if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      whereConditions.push({ createdAt: { less_than_equal: endDateObj.toISOString() } })
    }

    if (type) {
      whereConditions.push({ type: { equals: type } })
    }

    if (status) {
      whereConditions.push({ status: { equals: status } })
    }

    if (minAmount) {
      whereConditions.push({ amount: { greater_than_equal: parseFloat(minAmount) } })
    }

    if (maxAmount) {
      whereConditions.push({ amount: { less_than_equal: parseFloat(maxAmount) } })
    }

    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: { and: whereConditions },
      sort: '-createdAt',
      page,
      limit
    })

    // Calculate filtered totals
    const totalEarnings = earnings.docs.reduce((sum: number, e: any) => sum + e.amount, 0)
    const totalScans = earnings.docs.reduce((sum: number, e: any) => sum + (e.scans || 0), 0)
    const totalPoints = earnings.docs.reduce((sum: number, e: any) => sum + (e.points || 0), 0)

    return new Response(JSON.stringify({
      success: true,
      earnings: earnings.docs.map((earning: any) => ({
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
      })),
      summary: {
        totalEarnings,
        totalScans,
        totalPoints,
        count: earnings.totalDocs
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
    console.error('❌ Search driver earnings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to search driver earnings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * B8: Export Earnings History
 * Driver can export their earnings history as CSV
 */
export const exportDriverEarnings = async (req: PayloadRequest): Promise<Response> => {
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') || 'csv'

    console.log('📥 Exporting driver earnings:', { startDate, endDate, format })

    const whereConditions: any[] = [{ driver: { equals: user.id } }]

    if (startDate) {
      whereConditions.push({ createdAt: { greater_than_equal: new Date(startDate).toISOString() } })
    }

    if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      whereConditions.push({ createdAt: { less_than_equal: endDateObj.toISOString() } })
    }

    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: { and: whereConditions },
      sort: '-createdAt',
      limit: 10000 // Max export limit
    })

    if (format === 'csv') {
      const csvHeaders = 'Date,Type,Scans,Points,Amount,Currency,Status,Description,Paid At'
      const csvRows = earnings.docs.map((earning: any) => {
        const date = new Date(earning.createdAt).toISOString().split('T')[0]
        const paidAt = earning.paidAt ? new Date(earning.paidAt).toISOString().split('T')[0] : 'N/A'
        return `${date},${earning.type || 'N/A'},${earning.scans || 0},${earning.points || 0},${earning.amount},${earning.currency},${earning.status},"${earning.description || 'N/A'}",${paidAt}`
      }).join('\n')
      
      const csvContent = csvHeaders + '\n' + csvRows
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="driver-earnings-${Date.now()}.csv"`
        }
      })
    } else {
      // JSON format
      return new Response(JSON.stringify({
        success: true,
        exportData: earnings.docs.map((earning: any) => ({
          date: earning.createdAt,
          type: earning.type,
          scans: earning.scans || 0,
          points: earning.points || 0,
          amount: earning.amount,
          currency: earning.currency,
          status: earning.status,
          description: earning.description,
          paidAt: earning.paidAt
        })),
        summary: {
          totalRecords: earnings.totalDocs,
          totalAmount: earnings.docs.reduce((sum: number, e: any) => sum + e.amount, 0),
          totalScans: earnings.docs.reduce((sum: number, e: any) => sum + (e.scans || 0), 0),
          totalPoints: earnings.docs.reduce((sum: number, e: any) => sum + (e.points || 0), 0)
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('❌ Export driver earnings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export driver earnings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

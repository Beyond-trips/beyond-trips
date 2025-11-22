import { PayloadRequest } from 'payload'

interface RatingInput {
  driverId: string
  rating: number // 1-5 (fixed to match collection field name)
  review?: string
  category?: string
  raterName?: string
  raterEmail?: string
  raterPhone?: string
  deviceFingerprint?: string
  tripId?: string
}

// ===== PUBLIC RATING SUBMISSION =====

/**
 * Submit Rating for Driver (PUBLIC - No Authentication Required)
 * Riders can submit ratings without logging in
 */
export const submitRating = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await req.json()
    const { driverId, rating, review, category, raterName, raterEmail, raterPhone, deviceFingerprint, tripId } = body

    // Validation
    if (!driverId) {
      return new Response(JSON.stringify({
        error: 'driverId is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!rating || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({
        error: 'rating must be between 1 and 5'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!raterName || raterName.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'raterName is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⭐ Submitting rating for driver:', driverId, 'Rating:', rating)

    // Check if driver exists
    const driver = await req.payload.findByID({
      collection: 'users',
      id: driverId
    }).catch(() => null)

    if (!driver) {
      return new Response(JSON.stringify({
        error: 'Driver not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if driver role is actually 'driver'
    if ((driver as any).role !== 'driver') {
      return new Response(JSON.stringify({
        error: 'User is not a driver'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Anti-abuse: Check for duplicate ratings from same device/email
    if (deviceFingerprint) {
      const existingByDevice = await req.payload.find({
        collection: 'driver-ratings',
        where: {
          and: [
            { driver: { equals: driverId } },
            { deviceFingerprint: { equals: deviceFingerprint } }
          ]
        },
        limit: 1
      })

      if (existingByDevice.docs.length > 0) {
        return new Response(JSON.stringify({
          error: 'You have already rated this driver from this device'
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    if (raterEmail) {
      const existingByEmail = await req.payload.find({
        collection: 'driver-ratings',
        where: {
          and: [
            { driver: { equals: driverId } },
            { raterEmail: { equals: raterEmail } }
          ]
        },
        limit: 1
      })

      if (existingByEmail.docs.length > 0) {
        return new Response(JSON.stringify({
          error: 'You have already rated this driver with this email'
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Create rating record
    const ratingRecord = await req.payload.create({
      collection: 'driver-ratings',
      data: {
        driver: driverId,
        rating, // Fixed: using 'rating' instead of 'ratingValue'
        review: review || '',
        category: category || 'overall',
        raterName,
        raterEmail: raterEmail || null,
        raterPhone: raterPhone || null,
        deviceFingerprint: deviceFingerprint || null,
        tripId: tripId || null,
        isVerified: false,
        isPublic: true,
        isModerated: false,
      }
    })

    console.log('✅ Rating created:', ratingRecord.id)

    return new Response(JSON.stringify({
      success: true,
      message: 'Thank you for your rating!',
      rating: {
        id: ratingRecord.id,
        driverId,
        rating,
        review: review || '',
        createdAt: ratingRecord.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Submit rating error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit rating',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== DRIVER VIEW RATINGS =====

/**
 * H1: View My Rating
 * Driver views their overall rating
 */
export const getDriverRating = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⭐ Getting rating for driver:', user.id)

    // Get all ratings for this driver
    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: { driver: { equals: user.id } },
      limit: 1000
    })

    // Calculate average
    const totalRatings = ratings.docs.length
    const averageRating = totalRatings > 0
      ? (ratings.docs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalRatings).toFixed(2)
      : 0

    return new Response(JSON.stringify({
      success: true,
      rating: {
        overallRating: parseFloat(String(averageRating)),
        totalReviews: totalRatings,
        maxRating: 5
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get rating error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get rating'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * H2: View Review Count
 * Driver sees how many reviews they received
 */
export const getReviewCount = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Getting review count for driver:', user.id)

    const ratingsCount = await req.payload.count({
      collection: 'driver-ratings',
      where: { driver: { equals: user.id } }
    })

    return new Response(JSON.stringify({
      success: true,
      reviewCount: ratingsCount.totalDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get review count error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get review count'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * H3: View Recent Reviews
 * Driver views recent reviews and comments
 */
export const getRecentReviews = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('📝 Getting recent reviews for driver:', user.id)

    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: { driver: { equals: user.id } },
      sort: '-createdAt',
      limit
    })

    return new Response(JSON.stringify({
      success: true,
      reviews: ratings.docs.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        raterName: r.raterName,
        category: r.category,
        createdAt: r.createdAt,
        hasResponse: !!r.response,
        response: r.response,
        respondedAt: r.respondedAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get recent reviews error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get recent reviews'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== RATING CALCULATIONS =====

/**
 * H5: View Rating Breakdown
 * Driver sees breakdown of ratings (5-star count, 4-star count, etc.)
 */
export const getRatingBreakdown = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Getting rating breakdown for driver:', user.id)

    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: { driver: { equals: user.id } },
      limit: 1000
    })

    // Calculate breakdown
    const breakdown = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }

    ratings.docs.forEach((r: any) => {
      const ratingValue = r.rating
      if (ratingValue >= 1 && ratingValue <= 5) {
        breakdown[ratingValue as keyof typeof breakdown]++
      }
    })

    const total = ratings.totalDocs
    const percentages = {
      5: total > 0 ? ((breakdown[5] / total) * 100).toFixed(1) : 0,
      4: total > 0 ? ((breakdown[4] / total) * 100).toFixed(1) : 0,
      3: total > 0 ? ((breakdown[3] / total) * 100).toFixed(1) : 0,
      2: total > 0 ? ((breakdown[2] / total) * 100).toFixed(1) : 0,
      1: total > 0 ? ((breakdown[1] / total) * 100).toFixed(1) : 0
    }

    return new Response(JSON.stringify({
      success: true,
      breakdown: {
        5: breakdown[5],
        4: breakdown[4],
        3: breakdown[3],
        2: breakdown[2],
        1: breakdown[1],
        total
      },
      percentages: {
        5: parseFloat(String(percentages[5])),
        4: parseFloat(String(percentages[4])),
        3: parseFloat(String(percentages[3])),
        2: parseFloat(String(percentages[2])),
        1: parseFloat(String(percentages[1]))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get rating breakdown error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get rating breakdown'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== REVIEW RESPONSES =====

/**
 * H4: Respond to Reviews
 * Driver responds to a review/comment
 */
export const respondToReview = async (req: PayloadRequest): Promise<Response> => {
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
    const { reviewId, responseText } = body

    if (!reviewId || !responseText) {
      return new Response(JSON.stringify({
        error: 'reviewId and responseText are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('💬 Responding to review:', reviewId)

    // Get the review
    const review = await req.payload.findByID({
      collection: 'driver-ratings',
      id: reviewId
    })

    // Check if user is the driver being reviewed
    const reviewDriverId = typeof review.driver === 'object' ? (review.driver as any).id : review.driver
    if (reviewDriverId !== user.id) {
      return new Response(JSON.stringify({
        error: 'You can only respond to reviews for your own profile'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update review with response
    const updated = await req.payload.update({
      collection: 'driver-ratings',
      id: reviewId,
      data: {
        response: responseText,
        respondedAt: new Date().toISOString()
      }
    })

    console.log('✅ Review response added')

    return new Response(JSON.stringify({
      success: true,
      review: {
        id: updated.id,
        rating: (updated as any).rating,
        originalReview: (updated as any).review,
        response: responseText,
        respondedAt: (updated as any).respondedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Respond to review error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to respond to review',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== PUBLIC: GET DRIVER RATINGS =====

/**
 * Get public ratings for a specific driver (no auth required)
 */
export const getPublicDriverRatings = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { searchParams } = new URL(req.url || '')
    const driverId = searchParams.get('driverId')

    if (!driverId) {
      return new Response(JSON.stringify({
        error: 'driverId query parameter is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🌐 Getting public ratings for driver:', driverId)

    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: {
        and: [
          { driver: { equals: driverId } },
          { isPublic: { equals: true } }
        ]
      },
      sort: '-createdAt',
      limit: 100
    })

    // Calculate stats
    const totalRatings = ratings.docs.length
    const averageRating = totalRatings > 0
      ? (ratings.docs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalRatings).toFixed(2)
      : 0

    // Calculate breakdown
    const breakdown = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }

    ratings.docs.forEach((r: any) => {
      const ratingValue = r.rating
      if (ratingValue >= 1 && ratingValue <= 5) {
        breakdown[ratingValue as keyof typeof breakdown]++
      }
    })

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalRatings,
        averageRating: parseFloat(String(averageRating)),
        maxRating: 5,
        breakdown
      },
      ratings: ratings.docs.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        raterName: r.raterName,
        category: r.category,
        createdAt: r.createdAt,
        response: r.response,
        respondedAt: r.respondedAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get public driver ratings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver ratings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== ADMIN UTILITIES =====

/**
 * Get all ratings for admin review (with moderation filters)
 */
export const getDriverRatingsAdmin = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const driverId = searchParams.get('driverId')
    const isModerated = searchParams.get('isModerated')
    const minRating = searchParams.get('minRating')
    const maxRating = searchParams.get('maxRating')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('👨‍💼 Admin getting ratings - Filters:', { driverId, isModerated, minRating, maxRating })

    const whereConditions: any[] = []

    if (driverId) {
      whereConditions.push({ driver: { equals: driverId } })
    }

    if (isModerated) {
      whereConditions.push({ isModerated: { equals: isModerated === 'true' } })
    }

    if (minRating) {
      whereConditions.push({ rating: { greater_than_equal: parseInt(minRating) } })
    }

    if (maxRating) {
      whereConditions.push({ rating: { less_than_equal: parseInt(maxRating) } })
    }

    const ratings = await req.payload.find({
      collection: 'driver-ratings',
      where: whereConditions.length > 0 ? { and: whereConditions } : {},
      sort: '-createdAt',
      page,
      limit,
      depth: 2
    })

    return new Response(JSON.stringify({
      success: true,
      ratings: ratings.docs.map((r: any) => ({
        id: r.id,
        driver: typeof r.driver === 'object' ? {
          id: r.driver.id,
          firstName: r.driver.firstName,
          lastName: r.driver.lastName,
          email: r.driver.email
        } : { id: r.driver },
        rating: r.rating,
        review: r.review,
        raterName: r.raterName,
        raterEmail: r.raterEmail,
        raterPhone: r.raterPhone,
        category: r.category,
        createdAt: r.createdAt,
        response: r.response,
        respondedAt: r.respondedAt,
        isModerated: r.isModerated,
        moderationNotes: r.moderationNotes
      })),
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
    console.error('❌ Get driver ratings admin error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver ratings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Moderate rating (admin only)
 */
export const moderateRating = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { ratingId, isPublic, moderationNotes } = body

    if (!ratingId) {
      return new Response(JSON.stringify({
        error: 'ratingId is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🛡️ Admin moderating rating:', ratingId)

    const updated = await req.payload.update({
      collection: 'driver-ratings',
      id: ratingId,
      data: {
        isModerated: true,
        moderatedBy: user.id,
        isPublic: isPublic !== undefined ? isPublic : true,
        moderationNotes: moderationNotes || ''
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Rating moderated successfully',
      rating: {
        id: updated.id,
        isPublic: (updated as any).isPublic,
        isModerated: (updated as any).isModerated
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Moderate rating error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to moderate rating'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

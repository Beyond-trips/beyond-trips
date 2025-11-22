import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  getDriverRating,
  getReviewCount,
  getRecentReviews,
  getRatingBreakdown,
  respondToReview,
  getDriverRatingsAdmin,
  moderateRating
} from '@/endpoints/driverRatingsEndpoints'

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const clonedReq = req.clone()
    const body = await clonedReq.json()
    const { action } = body

    console.log('POST /api/driver/ratings - Action:', action)

    switch (action) {
      case 'respond-to-review':
        return respondToReview(req as any)
      case 'moderate-rating':
        return moderateRating(req as any)
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['respond-to-review', 'moderate-rating']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST ratings error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get-rating'

    console.log('GET /api/driver/ratings - Action:', action)

    switch (action) {
      case 'get-rating':
        return getDriverRating(req as any)
      case 'review-count':
        return getReviewCount(req as any)
      case 'recent-reviews':
        return getRecentReviews(req as any)
      case 'rating-breakdown':
        return getRatingBreakdown(req as any)
      case 'admin-ratings':
        return getDriverRatingsAdmin(req as any)
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['get-rating', 'review-count', 'recent-reviews', 'rating-breakdown', 'admin-ratings']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET ratings error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  submitRating,
  getPublicDriverRatings
} from '@/endpoints/driverRatingsEndpoints'

/**
 * Public Ratings API
 * No authentication required - riders can submit ratings
 */

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    
    console.log('POST /api/public/ratings - Public rating submission')
    
    return submitRating(req as any)
  } catch (error) {
    console.error('❌ POST public ratings error:', error)
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
    
    console.log('GET /api/public/ratings - Get public driver ratings')
    
    return getPublicDriverRatings(req as any)
  } catch (error) {
    console.error('❌ GET public ratings error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


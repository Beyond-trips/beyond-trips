import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public API endpoint to get total number of onboarded drivers
 * No authentication required - used by landing page
 * 
 * Returns: { "Total_drivers_onboarded": <number> }
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    console.log('📊 GET /api/onboarding/driver-id - Getting total drivers count')
    
    // Count all users in the collection (including those added bypassing Payload)
    const countResult = await payload.count({
      collection: 'users'
    })
    
    const totalDrivers = countResult.totalDocs || 0
    
    console.log(`✅ Total onboarded drivers: ${totalDrivers}`)
    
    return NextResponse.json({
      Total_drivers_onboarded: totalDrivers
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error) {
    console.error('❌ GET /api/onboarding/driver-id error:', error)
    return NextResponse.json({
      error: 'Failed to get driver count',
      Total_drivers_onboarded: 0
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }
}


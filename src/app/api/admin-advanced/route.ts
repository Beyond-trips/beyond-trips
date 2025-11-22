import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

// Import admin advanced endpoint functions
import {
  createMagazine,
  listMagazines,
  updateMagazine,
  deleteMagazine,
  getDistributionStats,
  getTrackingHistory,
  getDistributionByDriver,
  getAllSettings,
  getSettings,
  createSetting,
  updateSetting,
  deleteSetting
} from '@/endpoints/adminAdvancedEndpoints'

interface PayloadRequest extends NextRequest {
  payload?: any
  user?: any
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const payloadRequest = req as PayloadRequest
    payloadRequest.payload = payload

    // Use Payload's built-in authentication
    try {
      const authResponse = await payload.auth({ headers: req.headers })
      if (!authResponse.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      console.error('❌ Auth failed:', String(e))
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get action from query
    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'listMagazines':
        return await listMagazines(payloadRequest)
      case 'getDistributionStats':
        return await getDistributionStats(payloadRequest)
      case 'getTrackingHistory':
        return await getTrackingHistory(payloadRequest)
      case 'getDistributionByDriver':
        return await getDistributionByDriver(payloadRequest)
      case 'getAllSettings':
        return await getAllSettings(payloadRequest)
      case 'getSettings':
        return await getSettings(payloadRequest)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('❌ Admin advanced error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const payloadRequest = req as PayloadRequest
    payloadRequest.payload = payload

    // Use Payload's built-in authentication
    try {
      const authResponse = await payload.auth({ headers: req.headers })
      if (!authResponse.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      console.error('❌ Auth failed (POST):', String(e))
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get action from query
    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'createMagazine':
        return await createMagazine(payloadRequest)
      case 'updateMagazine':
        return await updateMagazine(payloadRequest)
      case 'deleteMagazine':
        return await deleteMagazine(payloadRequest)
      case 'createSetting':
        return await createSetting(payloadRequest)
      case 'updateSetting':
        return await updateSetting(payloadRequest)
      case 'deleteSetting':
        return await deleteSetting(payloadRequest)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('❌ Admin advanced POST error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

import {
  getAllRoles,
  createRole,
  getRole,
  updateRole,
  assignRole,
  checkPermission,
  broadcastNotification,
  scheduleNotification,
  getNotificationHistory
} from '@/endpoints/adminPremiumEndpoints'

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
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'getAllRoles':
        return await getAllRoles(payloadRequest)
      case 'getRole':
        return await getRole(payloadRequest)
      case 'getNotificationHistory':
        return await getNotificationHistory(payloadRequest)
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin premium error:', error)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
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
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'createRole':
        return await createRole(payloadRequest)
      case 'updateRole':
        return await updateRole(payloadRequest)
      case 'assignRole':
        return await assignRole(payloadRequest)
      case 'checkPermission':
        return await checkPermission(payloadRequest)
      case 'broadcastNotification':
        return await broadcastNotification(payloadRequest)
      case 'scheduleNotification':
        return await scheduleNotification(payloadRequest)
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin premium POST error:', error)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

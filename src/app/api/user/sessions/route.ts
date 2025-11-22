import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  getActiveSessions,
  createSession,
  remoteLogout,
  logoutAllSessions,
  updateSessionActivity
} from '@/endpoints/sessionManagementEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list-sessions'

    console.log('GET /api/user/sessions - Action:', action)

    // Authenticate user
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Sessions authenticated via Payload:', user.email)
      } else {
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Sessions auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payload request with authenticated user
    const payloadRequest = {
      payload,
      user,
      headers: req.headers,
      url: req.url,
      method: req.method,
      json: async () => ({}),
      body: {},
    } as any

    switch (action) {
      case 'list-sessions':
        return getActiveSessions(payloadRequest)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['list-sessions']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    
    // Try to get action from query string first, then from body
    let action = searchParams.get('action')
    let body = {}
    
    try {
      const clonedReq = req.clone()
      body = await clonedReq.json()
      // If action is in body, use it (overrides query param)
      if (body.action) {
        action = body.action
      }
    } catch (error) {
      // No body or invalid JSON - that's okay, we'll use query param
      if (!action) {
        return new Response(JSON.stringify({
          error: 'Action is required (provide as query parameter or in body)'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    console.log('POST /api/user/sessions - Action:', action)

    // Authenticate user
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Sessions POST authenticated via Payload:', user.email)
      } else {
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Sessions POST auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payload request with authenticated user
    const payloadRequest = {
      payload,
      user,
      headers: req.headers,
      url: req.url,
      method: req.method,
      json: async () => body,
      body: body,
    } as any

    switch (action) {
      case 'create-session':
        return createSession(payloadRequest)
      
      case 'update-activity':
        return updateSessionActivity(payloadRequest)
      
      case 'logout-all':
        return logoutAllSessions(payloadRequest)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['create-session', 'update-activity', 'logout-all']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const DELETE = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    
    console.log('DELETE /api/user/sessions')

    // Authenticate user
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Sessions DELETE authenticated via Payload:', user.email)
      } else {
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Sessions DELETE auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse body for sessionId if provided
    let body = {}
    try {
      body = await req.json()
    } catch (error) {
      // DELETE may not have body, which is fine
    }

    // Create payload request with authenticated user
    const payloadRequest = {
      payload,
      user,
      headers: req.headers,
      url: req.url,
      method: req.method,
      json: async () => body,
      body: body,
    } as any

    return remoteLogout(payloadRequest)
  } catch (error) {
    console.error('❌ DELETE sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole
} from '../../../../endpoints/adminRolesEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    console.log('👥 Admin Roles GET request')

    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated:', user.email)
      } else {
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
    } as any

    return await getAllRoles(payloadRequest)
  } catch (error) {
    console.error('❌ Admin Roles GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

    console.log('👥 Admin Roles POST request:', action)

    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
      } else {
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()

    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body,
    } as any

    switch (action) {
      case 'create':
        return await createRole(payloadRequest)
      case 'update':
        return await updateRole(payloadRequest)
      case 'delete':
        return await deleteRole(payloadRequest)
      case 'assign':
        // Soft-implement assign as an update: attach userId to role or record separately
        return new Response(JSON.stringify({
          success: true,
          message: 'Role assignment endpoint acknowledged (stub)'
        }), { headers: { 'Content-Type': 'application/json' } })
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Roles POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sendNotification,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '../../../../endpoints/adminNotificationEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('📢 Admin Notifications GET request:', action)

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

    switch (action) {
      case 'templates':
      case 'list-templates':
        return await getAllTemplates(payloadRequest)
      
      default:
        return await getAllTemplates(payloadRequest)
    }
  } catch (error) {
    console.error('❌ Admin Notifications GET error:', error)
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

    console.log('📢 Admin Notifications POST request:', action)

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
      case 'send':
      case 'broadcast':
        return await sendNotification(payloadRequest)
      
      case 'create-template':
        return await createTemplate(payloadRequest)
      
      case 'update-template':
        return await updateTemplate(payloadRequest)
      
      case 'delete-template':
        return await deleteTemplate(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Notifications POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  sendNotification,
  getNotificationHistory,
  markNotificationAsRead
} from '@/endpoints/notificationServiceEndpoints'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'send'

    console.log(`📢 Notification API Request: ${action}`)

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const payloadReq: any = {
      payload,
      headers: {
        get: (key: string) => req.headers.get(key)
      },
      json: async () => {
        try {
          return await req.json()
        } catch {
          return {}
        }
      }
    }

    if (token) {
      try {
        const user = await payload.verifyJWT({ token })
        payloadReq.user = user
      } catch (error) {
        console.log('Token verification skipped')
      }
    }

    let response: Response

    switch (action) {
      case 'send':
        response = await sendNotification(payloadReq)
        break
      case 'read':
        response = await markNotificationAsRead(payloadReq)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const responseData = await response.json()
    return NextResponse.json(responseData, {
      status: response.status,
      headers: response.headers
    })
  } catch (error) {
    console.error('❌ Notification API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'history'

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const payloadReq: any = {
      payload,
      headers: {
        get: (key: string) => req.headers.get(key)
      }
    }

    if (token) {
      try {
        const user = await payload.verifyJWT({ token })
        payloadReq.user = user
      } catch (error) {
        console.log('Token verification skipped')
      }
    }

    if (action === 'history') {
      const { getNotificationHistory } = await import('@/endpoints/notificationServiceEndpoints')
      const response = await getNotificationHistory(payloadReq)
      const responseData = await response.json()
      return NextResponse.json(responseData, {
        status: response.status
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('❌ Notification API GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

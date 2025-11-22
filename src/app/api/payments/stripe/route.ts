import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  createPaymentIntent,
  handleStripeWebhook,
  getPaymentStatus,
  processRefund,
  getPaymentHistory,
  testPayment
} from '@/endpoints/stripePaymentEndpoints'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'create-intent'

    console.log(`📨 Stripe API Request: ${action}`)

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Create request object compatible with PayloadRequest
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
      },
      text: async () => {
        return await req.text()
      }
    }

    // Get user from token if provided
    if (token) {
      try {
        const user = await payload.verifyJWT({ token })
        payloadReq.user = user
      } catch (error) {
        console.log('Token verification skipped:', String(error))
      }
    }

    // Route to appropriate handler
    let response: Response

    switch (action) {
      case 'create-intent':
        response = await createPaymentIntent(payloadReq)
        break
      case 'webhook':
        response = await handleStripeWebhook(payloadReq)
        break
      case 'status':
        const paymentIntentId = url.searchParams.get('paymentIntentId')
        response = await getPaymentStatus(payloadReq, paymentIntentId || '')
        break
      case 'refund':
        response = await processRefund(payloadReq)
        break
      case 'history':
        response = await getPaymentHistory(payloadReq)
        break
      case 'test':
        response = await testPayment(payloadReq)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Convert Response to NextResponse
    const responseData = await response.json()
    return NextResponse.json(responseData, {
      status: response.status,
      headers: response.headers
    })
  } catch (error) {
    console.error('❌ Stripe API Error:', error)
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

    let response: Response

    if (action === 'status') {
      const paymentIntentId = url.searchParams.get('paymentIntentId')
      response = await getPaymentStatus(payloadReq, paymentIntentId || '')
    } else if (action === 'history') {
      response = await getPaymentHistory(payloadReq)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const responseData = await response.json()
    return NextResponse.json(responseData, {
      status: response.status,
      headers: response.headers
    })
  } catch (error) {
    console.error('❌ Stripe API GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

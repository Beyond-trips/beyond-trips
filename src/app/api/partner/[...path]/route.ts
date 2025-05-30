// src/app/api/partner/[...path]/route.ts
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'

// Import all partner functions
import { 
  startPartnerRegistration,
  verifyEmail,
  resendVerificationCode,
  createAdCampaign,
  getSubscriptionPlans,
  setupPaymentBudgeting,
  completeRegistration,
  getRegistrationStatus
} from '../../../../endpoints/partnerRegistration'

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path || []
  const pathname = path.join('/')
  
  const payload = await getPayload({ config })
  const payloadRequest = {
    payload,
    headers: req.headers,
    url: req.url,
    method: req.method,
  }

  try {
    if (pathname === 'subscription-plans') {
      return await getSubscriptionPlans(payloadRequest as any)
    }
    
    if (pathname.startsWith('status/')) {
      return await getRegistrationStatus(payloadRequest as any)
    }

    return NextResponse.json({ error: 'Partner endpoint not found' }, { status: 404 })
  } catch (error) {
    console.error('Partner GET error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path || []
  const pathname = path.join('/')
  
  const payload = await getPayload({ config })
  
  // Create the request object that partner functions expect
  const payloadRequest = {
    payload,
    headers: req.headers,
    json: async () => {
      const text = await req.text()
      return text ? JSON.parse(text) : {}
    },
    body: req.body,
    url: req.url,
    method: req.method,
  }

  try {
    switch (pathname) {
      case 'register/start':
        return await startPartnerRegistration(payloadRequest as any)
      case 'verify-email':
        return await verifyEmail(payloadRequest as any)
      case 'resend-code':
        return await resendVerificationCode(payloadRequest as any)
      case 'create-campaign':
        return await createAdCampaign(payloadRequest as any)
      case 'setup-payment':
        return await setupPaymentBudgeting(payloadRequest as any)
      case 'complete':
        return await completeRegistration(payloadRequest as any)
      default:
        return NextResponse.json({ 
          error: 'Partner endpoint not found',
          path: pathname 
        }, { status: 404 })
    }
  } catch (error) {
    console.error('Partner POST error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
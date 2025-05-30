// src/app/api/partner/[...path]/route.ts
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'

import { 
  startPartnerRegistration,
  verifyEmail,
  resendVerificationCode,
  createAdCampaign,
  getSubscriptionPlans,
  setupPaymentBudgeting,
  completeRegistration,
  getRegistrationStatus
} from '@/endpoints/partnerRegistration'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path || []
  const pathname = path.join('/')
  
  const payload = await getPayload({ config: configPromise })
  const payloadRequest = {
    payload,
    headers: req.headers,
    url: req.url,
    method: req.method,
  }

  if (pathname === 'subscription-plans') {
    return await getSubscriptionPlans(payloadRequest as any)
  }
  
  if (pathname.startsWith('status/')) {
    return await getRegistrationStatus(payloadRequest as any)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path || []
  const pathname = path.join('/')
  
  const payload = await getPayload({ config: configPromise })
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
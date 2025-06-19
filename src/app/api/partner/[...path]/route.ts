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
  getRegistrationStatus,
  loginPartner,
  logout,
  me,
  updatePartnerProfile,
  forgotPassword,
  resetPassword,
  verifyPasswordResetOTP
} from '../../../../endpoints/partnerRegistration'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  
  const payload = await getPayload({ config })
  const payloadRequest = {
    payload,
    headers: req.headers,
    url: req.url,
    method: req.method,
  }

  try {
    switch (pathname) {
      case 'subscription-plans':
        return await getSubscriptionPlans(payloadRequest as any)
      
      case 'me':
        return await me(payloadRequest as any)
      
      case 'verify-reset-otp':
        return await verifyPasswordResetOTP(payloadRequest as any)
        
      default:
        if (pathname.startsWith('status/')) {
          return await getRegistrationStatus(payloadRequest as any)
        }
        
        return NextResponse.json({ error: 'Partner endpoint not found' }, { status: 404 })
    }
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
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  
  const payload = await getPayload({ config })
  
  // Create the request object that partner functions expect
  const payloadRequest = {
    payload,
    headers: req.headers,
    json: async () => {
      try {
        const text = await req.text()
        return text ? JSON.parse(text) : {}
      } catch (error) {
        console.error('Error parsing JSON:', error)
        return {}
      }
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
      case 'login':
        return await loginPartner(payloadRequest as any)
      case 'logout':
        return await logout(payloadRequest as any)
      case 'forgot-password':
        return await forgotPassword(payloadRequest as any)
      case 'reset-password':
        return await resetPassword(payloadRequest as any)
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  
  const payload = await getPayload({ config })
  
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
      case 'me':
        return await updatePartnerProfile(payloadRequest as any)
      default:
        return NextResponse.json({
          error: 'Partner endpoint not found',
          path: pathname
        }, { status: 404 })
    }
  } catch (error) {
    console.error('Partner PUT error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
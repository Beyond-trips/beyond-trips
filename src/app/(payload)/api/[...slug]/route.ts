// src/app/(payload)/api/[...slug]/route.ts
import { REST_KEY, extractJWT } from 'payload'
import { headers as getHeaders } from 'next/headers'
import { NextRequest } from 'next/server'

import configPromise from '../../../../payload.config'
import { getPayloadHMR } from '@payloadcms/next/utilities'

// Import partner registration functions
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

// Helper to check if this is a custom route we handle
const isCustomRoute = (pathname: string): boolean => {
  return pathname.startsWith('/api/partner/') || 
         pathname === '/api/test-email' ||
         pathname === '/api/auth/generate-otp' ||
         pathname === '/api/auth/verify-otp'
}

// Main handler that delegates to Payload's REST API
const handler = async (req: NextRequest) => {
  const url = new URL(req.url)
  const pathname = url.pathname

  // Only intercept our custom routes
  if (!isCustomRoute(pathname)) {
    // Let Payload handle everything else (including /api/users/login)
    const payload = await getPayloadHMR({ config: configPromise })
    const headers = getHeaders()

    return payload.rest({
      headers: {
        get: (key: string) => headers.get(key),
        [REST_KEY]: true,
      },
      url: req.url,
      method: req.method,
      body: req.body,
    } as any)
  }

  // Handle our custom routes
  const pathParts = pathname.replace('/api/', '').split('/')
  const [firstPart, secondPart, thirdPart] = pathParts

  // Test email endpoint
  if (firstPart === 'test-email' && req.method === 'GET') {
    const { testEmailConnection } = await import('../../../../lib/email')
    const result = await testEmailConnection()
    return Response.json(result)
  }

  // Handle PARTNER endpoints
  if (firstPart === 'partner' && req.method === 'POST') {
    const payload = await getPayloadHMR({ config: configPromise })
    
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

    if (secondPart === 'register' && thirdPart === 'start') {
      return await startPartnerRegistration(payloadRequest as any)
    }
    
    if (secondPart === 'verify-email') {
      return await verifyEmail(payloadRequest as any)
    }
    
    if (secondPart === 'resend-code') {
      return await resendVerificationCode(payloadRequest as any)
    }
    
    if (secondPart === 'create-campaign') {
      return await createAdCampaign(payloadRequest as any)
    }
    
    if (secondPart === 'setup-payment') {
      return await setupPaymentBudgeting(payloadRequest as any)
    }
    
    if (secondPart === 'complete') {
      return await completeRegistration(payloadRequest as any)
    }
  }

  if (firstPart === 'partner' && secondPart === 'subscription-plans' && req.method === 'GET') {
    const payload = await getPayloadHMR({ config: configPromise })
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
    }
    return await getSubscriptionPlans(payloadRequest as any)
  }

  if (firstPart === 'partner' && secondPart === 'status' && thirdPart && req.method === 'GET') {
    const payload = await getPayloadHMR({ config: configPromise })
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
    }
    return await getRegistrationStatus(payloadRequest as any)
  }

  // Handle custom auth endpoints (OTP system)
  if (firstPart === 'auth' && req.method === 'POST') {
    const payload = await getPayloadHMR({ config: configPromise })
    
    if (secondPart === 'generate-otp') {
      const body = await req.json()
      const { email } = body

      if (!email) {
        return Response.json({ error: 'Email is required' }, { status: 400 })
      }

      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      let user
      if (users.docs.length === 0) {
        user = await payload.create({
          collection: 'users',
          data: {
            email,
            password: 'TempPassword123!',
            username: email.split('@')[0],
            role: 'user',
            emailVerified: false,
          },
        })
      } else {
        user = users.docs[0]
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          otp,
          otpExpiry: otpExpiry.toISOString(),
        },
      })

      const { sendOTPEmail } = await import('../../../../lib/email')
      const emailResult = await sendOTPEmail(email, otp)

      return Response.json({
        success: true,
        message: emailResult.success 
          ? 'OTP sent to your email successfully' 
          : 'OTP generated but email sending failed',
        userId: user.id,
        emailSent: emailResult.success,
        otp: otp
      })
    }

    if (secondPart === 'verify-otp') {
      const body = await req.json()
      const { email, otp } = body

      if (!email || !otp) {
        return Response.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      if (users.docs.length === 0) {
        return Response.json({ error: 'User not found' }, { status: 400 })
      }

      const user = users.docs[0]

      if (!user.otp || user.otp !== otp) {
        return Response.json({ error: 'Invalid OTP' }, { status: 400 })
      }

      if (!user.otpExpiry || new Date(user.otpExpiry) <= new Date()) {
        return Response.json({ error: 'OTP has expired' }, { status: 400 })
      }

      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          otp: null,
          otpExpiry: null,
          emailVerified: true,
        },
      })

      return Response.json({
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      })
    }
  }

  // If no custom route matches, return 404
  return Response.json({
    error: 'Endpoint not found',
    path: pathname,
    method: req.method
  }, { status: 404 })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
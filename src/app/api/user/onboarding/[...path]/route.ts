// src/app/api/user/onboarding/[...path]/route.ts
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import jwt from 'jsonwebtoken'

// Import user onboarding functions
import {
  getUserOnboardingStatus,
  uploadUserDocuments,
  saveUserBankDetails,
  completeUserTraining,
  completeUserOnboarding,
  updateUserProfile,
  userForgotPassword,
  verifyUserPasswordResetOTP, // New function for OTP verification
  userResetPassword,

} from '../../../../../endpoints/userVerification'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  const payload = await getPayload({ config })
  
  // Get user from session/token
  const authHeader = req.headers.get('authorization')
  const user = null
  
  if (authHeader?.startsWith('Bearer ')) {
    // Handle JWT token authentication if you're using it
    // For now, we'll rely on Payload's built-in auth
  }
  
  const payloadRequest = {
    payload,
    headers: req.headers,
    url: req.url,
    method: req.method,
    user, // This will be populated by Payload's auth middleware
  }

  try {
    switch (pathname) {
      case 'status':
        return await getUserOnboardingStatus(payloadRequest as any)
      default:
        return NextResponse.json({ error: 'Onboarding endpoint not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('User onboarding GET error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Update your route to use Payload's built-in auth
// src/app/api/user/onboarding/[...path]/route.ts

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  const payload = await getPayload({ config })
  
  // For authenticated routes, use Payload's auth
  let user = null
  if (pathname === 'bank-details' || pathname === 'profile'|| pathname === 'documents') {
    try {
      // Use Payload's built-in authentication
      // Pass the NextRequest headers directly - they're already a Headers object
      const authResult = await payload.auth({ 
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Authenticated via Payload:', user.email)
      } else {
        console.log('❌ No authenticated user found')
        return NextResponse.json({
          error: 'Authentication required',
          message: 'You must be logged in to save bank details'
        }, { status: 401 })
      }
    } catch (error) {
      console.error('❌ Payload auth error:', error)
      return NextResponse.json({
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 401 })
    }
  }
  
  // Create the request object that onboarding functions expect
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
    user: user, // Now properly populated using Payload's auth
  }

  try {
    switch (pathname) {
      case 'documents':
        return await uploadUserDocuments(payloadRequest as any)
      case 'bank-details':
        // User is already authenticated above
        return await saveUserBankDetails(payloadRequest as any)
      case 'training':
        return await completeUserTraining(payloadRequest as any)
      case 'complete':
        return await completeUserOnboarding(payloadRequest as any)
      case 'profile':
        // User is already authenticated above
        return await updateUserProfile(payloadRequest as any)
      case 'forgot-password-otp':
        return await userForgotPassword(payloadRequest as any)
      
      case 'verify-reset-otp': // NEW ENDPOINT
        return await verifyUserPasswordResetOTP(payloadRequest as any)
      
      case 'reset-password':
        return await userResetPassword(payloadRequest as any)
      default:
        return NextResponse.json({
          error: 'Onboarding endpoint not found',
          path: pathname
        }, { status: 404 })
    }
  } catch (error) {
    console.error('User onboarding POST error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
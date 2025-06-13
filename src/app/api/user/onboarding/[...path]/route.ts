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
  updateUserProfile
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
  let user = null
  
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathname = (path || []).join('/')
  const payload = await getPayload({ config })
  
  // ONLY ADD AUTH FOR BANK-DETAILS AND PROFILE - INSIDE THE POST FUNCTION!
  let user = null
  if (pathname === 'bank-details' || pathname === 'profile') {
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        
        // IMPORTANT: Use JWT_SECRET instead of PAYLOAD_SECRET
        // This matches how tokens are created in your system
        console.log('🔑 Using JWT_SECRET for verification')
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
        console.log('✅ JWT verified successfully:', { id: decoded.id, email: decoded.email })
        
        // Get user from database
        const users = await payload.find({
          collection: 'users',
          where: {
            id: { equals: decoded.id }
          },
          limit: 1
        })
        
        if (users.docs.length > 0) {
          user = users.docs[0]
          console.log('🏦 Auth successful for:', pathname, 'User:', user.email)
        } else {
          console.log('⚠️ User not found in database for ID:', decoded.id)
        }
      } else {
        console.log('⚠️ No Bearer token found in authorization header')
      }
    } catch (error) {
      console.error('❌ Auth failed for', pathname, ':', error)
      // For authenticated endpoints, return 401 if auth fails
      if (error instanceof jwt.JsonWebTokenError) {
        return NextResponse.json({
          error: 'Invalid or expired token',
          details: error.message
        }, { status: 401 })
      }
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
    user: user, // Now properly populated for bank-details and profile only
  }

  try {
    switch (pathname) {
      case 'documents':
        return await uploadUserDocuments(payloadRequest as any)
      case 'bank-details':
        // Check if user is authenticated for bank-details
        if (!user) {
          return NextResponse.json({
            error: 'Authentication required',
            message: 'You must be logged in to save bank details'
          }, { status: 401 })
        }
        return await saveUserBankDetails(payloadRequest as any)
      case 'training':
        return await completeUserTraining(payloadRequest as any)
      case 'complete':
        return await completeUserOnboarding(payloadRequest as any)
      case 'profile':
        // Check if user is authenticated for profile
        if (!user) {
          return NextResponse.json({
            error: 'Authentication required',
            message: 'You must be logged in to update profile'
          }, { status: 401 })
        }
        return await updateUserProfile(payloadRequest as any)
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
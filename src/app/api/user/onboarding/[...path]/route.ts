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
  completeUserOnboarding
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
  
  // ONLY ADD AUTH FOR BANK-DETAILS - INSIDE THE POST FUNCTION!
  let user = null
  if (pathname === 'bank-details') {
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        
        // Verify JWT token using PAYLOAD_SECRET (same as in your config)
        console.log('🔑 Using PAYLOAD_SECRET for verification')
        const decoded = jwt.verify(token, process.env.PAYLOAD_SECRET || '') as any
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
          console.log('🏦 Bank details auth: User', user.email)
        }
      }
    } catch (error) {
      console.error('❌ Bank details auth failed:', error)
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
    user: user, // Now properly populated for bank-details only
  }

  try {
    switch (pathname) {
      case 'documents':
        return await uploadUserDocuments(payloadRequest as any)
      case 'bank-details':
        return await saveUserBankDetails(payloadRequest as any) // Now has authenticated user
      case 'training':
        return await completeUserTraining(payloadRequest as any)
      case 'complete':
        return await completeUserOnboarding(payloadRequest as any)
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
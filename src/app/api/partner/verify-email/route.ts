// src/app/api/partner/verify-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { businessId, verificationCode } = body

    const businessDetails = await payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Check if already verified
    if ((businessDetails as any).emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
        nextStep: 'ad_campaign_setup',
      })
    }

    // In development mode, accept a test code
    const isDevelopment = process.env.NODE_ENV === 'development'
    const testCode = '999999' // Universal test code for development
    
    const validCode = (businessDetails as any).verificationCode === verificationCode ||
                     (isDevelopment && verificationCode === testCode)

    if (!validCode) {
      // In development, provide a hint
      if (isDevelopment) {
        return NextResponse.json(
          { 
            error: 'Invalid verification code',
            hint: `In development, use the actual code: ${(businessDetails as any).verificationCode} or test code: ${testCode}`
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Update business details
    await payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        emailVerified: true,
        verificationCode: null,
        registrationStatus: 'email_verified',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      nextStep: 'ad_campaign_setup',
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
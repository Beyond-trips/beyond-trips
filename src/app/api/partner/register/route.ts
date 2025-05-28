import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import { sendOTPEmail } from '../../../../lib/email' // Import your existing email function


export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    
    const { 
      companyEmail, 
      password, 
      confirmPassword, 
      companyName, 
      companyAddress, 
      contact, 
      industry 
    } = body

    // Validate password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    // Check if business already exists
    const existingBusiness = await payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: companyEmail,
        },
      },
      limit: 1,
    })

    if (existingBusiness.docs.length > 0) {
      return NextResponse.json(
        { error: 'Business email already registered' },
        { status: 400 }
      )
    }

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString()

    // Create business details
    const businessDetails = await payload.create({
      collection: 'business-details',
      data: {
        companyEmail,
        password, // In production, this should be hashed
        companyName,
        companyAddress,
        contact,
        industry,
        emailVerified: false,
        verificationCode,
        verificationCodeExpiry:"",
        registrationStatus: 'pending',
        registrationDate: new Date().toISOString(),
      },
    })

    // TODO: Send verification email here
    const emailResult = await sendOTPEmail(companyEmail, verificationCode)
    
    return new Response(JSON.stringify({
      success: true,
      businessId: businessDetails.id,
      message: 'Registration started. Please check your email for verification code.',
      emailSent: true,
      // In development, include the code
      ...(process.env.NODE_ENV === 'development' && { verificationCode }),
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Registration error:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    return new NextResponse(JSON.stringify({ 
      error: 'Registration failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}



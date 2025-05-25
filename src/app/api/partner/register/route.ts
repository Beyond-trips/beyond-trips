import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

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
        registrationStatus: 'pending',
        registrationDate: new Date().toISOString(),
      },
    })

    // TODO: Send verification email here
    console.log(`🔐 Verification code for ${companyEmail}: ${verificationCode}`)

    return NextResponse.json({
      success: true,
      businessId: businessDetails.id,
      message: 'Registration started. Please check your email for verification code.',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed', details: error },
      { status: 500 }
    )
  }
}

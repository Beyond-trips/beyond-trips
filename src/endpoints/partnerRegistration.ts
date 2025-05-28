// endpoints/partnerRegistration.ts

import crypto from 'crypto'
import type { PayloadRequest } from 'payload'
import { sendOTPEmail } from '../lib/email' // Import your existing email function


// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return req.body
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// 1. Start Partner Registration
export const startPartnerRegistration = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
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
      return new Response(JSON.stringify({ error: 'Passwords do not match' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if business already exists
    const existingBusiness = await req.payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: companyEmail,
        },
      },
      limit: 1,
    })

    if (existingBusiness.docs.length > 0) {
      return new Response(JSON.stringify({ error: 'Business email already registered' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate verification code (OTP)
    const verificationCode = crypto.randomInt(100000, 999999).toString()
    
    // Create business details with verification code
    const businessDetails = await req.payload.create({
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
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes expiry
        registrationStatus: 'pending',
        registrationDate: new Date().toISOString(),
      },
    })
    
    // Send verification email using your existing function
    console.log(`🔐 Sending verification code to ${companyEmail}`)
    const emailResult = await sendOTPEmail(companyEmail, verificationCode)
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      // You might want to delete the business record if email fails
      // await req.payload.delete({
      //   collection: 'business-details',
      //   id: businessDetails.id,
      // })
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send verification email', 
        details: emailResult.error 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      businessId: businessDetails.id,
      message: 'Registration started. Please check your email for verification code.',
      emailSent: true,
      // In development, you might want to include the code
      ...(process.env.NODE_ENV === 'development' && { verificationCode }),
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return new Response(JSON.stringify({ 
      error: 'Registration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Also update the verify email function to check expiry
export const verifyEmail = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId, verificationCode } = body
    
    if (!businessId || !verificationCode) {
      return new Response(JSON.stringify({ 
        error: 'Business ID and verification code are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Find business by ID
    const business = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    }) as any
    
    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Check if already verified
    if (business.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Check verification code
    if (business.verificationCode !== verificationCode) {
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Check if code is expired
    if (business.verificationCodeExpiry && new Date(business.verificationCodeExpiry) < new Date()) {
      return new Response(JSON.stringify({ error: 'Verification code has expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Update business as verified
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        emailVerified: true,
        verificationCode: null, // Clear the code
        verificationCodeExpiry: null,
        registrationStatus: 'email_verified',
      },
    })
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      nextStep: 'create_ad_campaign',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return new Response(JSON.stringify({ 
      error: 'Verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Add resend functionality using the same email function
export const resendVerificationCode = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId } = body
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'Business ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Find business
    const business = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    }) as any
    
    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (business.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Generate new verification code
    const newVerificationCode = crypto.randomInt(100000, 999999).toString()
    
    // Update business with new code
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        verificationCode: newVerificationCode,
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    })
    
    // Send new verification email
    const emailResult = await sendOTPEmail(business.companyEmail, newVerificationCode)
    
    if (!emailResult.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to send verification email',
        details: emailResult.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'New verification code sent to your email',
      // In development, include the code
      ...(process.env.NODE_ENV === 'development' && { verificationCode: newVerificationCode }),
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to resend verification code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
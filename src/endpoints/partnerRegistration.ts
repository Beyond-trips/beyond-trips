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

export const startPartnerRegistration = async (req: PayloadRequest): Promise<Response> => {
  try {
    console.log('🔍 Starting partner registration...')
    console.log('Available collections:', Object.keys(req.payload.collections))
    
    const body = await parseRequestBody(req)
    console.log('📝 Received data:', JSON.stringify(body, null, 2))
    
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
    
    console.log('🔍 Checking for existing business...')
    
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
    
    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString()
    console.log(`🔐 Generated verification code: ${verificationCode}`)
    
    console.log('📝 Creating business details...')
    
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
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
        registrationStatus: 'pending',
        registrationDate: new Date(),
      } as any,
    })
    
    console.log('✅ Business details created:', businessDetails.id)
    
    // Send verification email
    console.log(`📧 Sending verification email to ${companyEmail}...`)
    const emailResult = await sendOTPEmail(companyEmail, verificationCode)
    
    if (!emailResult.success) {
      console.error('❌ Failed to send verification email:', emailResult.error)
      return new Response(JSON.stringify({ 
        error: 'Failed to send verification email', 
        details: emailResult.error 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ Email sent successfully')
    
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
    
    return new Response(JSON.stringify({ 
      error: 'Registration failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
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




// 3. Resend Verification Code
export const resendVerificationCode = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId } = body

    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails || (businessDetails as any).emailVerified) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Update business details with new code
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        verificationCode,
        verificationCodeExpiry: codeExpiry.toISOString(),
      },
    })

    // Send verification email
    const emailResult = await sendOTPEmail(
      (businessDetails as any).companyEmail,
      verificationCode
    )

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: emailResult.success 
          ? 'Verification code resent successfully' 
          : 'Code generated but email sending failed',
        emailSent: emailResult.success
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Resend code error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend verification code' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}; 

    
    

// 4. Create Ad Campaign
export const createAdCampaign = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId, campaignType, campaignName, campaignDescription } = body

    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails || !(businessDetails as any).emailVerified) {
      return new Response(JSON.stringify({ error: 'Email must be verified first' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create ad campaign
    const adCampaign = await req.payload.create({
      collection: 'ad-campaigns',
      data: {
        businessId,
        campaignType,
        campaignName: campaignName || `Campaign for ${(businessDetails as any).companyName}`,
        campaignDescription,
        status: 'draft',
      },
    })

    // Update business registration status
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'campaign_setup',
      },
    })

    return new Response(JSON.stringify({
      success: true,
      campaignId: adCampaign.id,
      message: 'Ad campaign created successfully',
      nextStep: 'payment_setup',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Ad campaign creation error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create ad campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// 5. Get Available Subscription Plans
export const getSubscriptionPlans = async (req: PayloadRequest): Promise<Response> => {
  try {
    const plans = await req.payload.find({
      collection: 'subscription-plans',
      where: {
        isActive: {
          equals: true,
        },
      },
    })

    return new Response(JSON.stringify({
      success: true,
      plans: plans.docs,
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get plans error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get subscription plans' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// 6. Setup Payment and Budgeting
export const setupPaymentBudgeting = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId, pricingTier, monthlyBudget, paymentMethod } = body

    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payment budgeting record
    const paymentBudgeting = await req.payload.create({
      collection: 'payment-budgeting',
      data: {
        businessId,
        pricingTier,
        monthlyBudget,
        paymentMethod,
        paymentStatus: 'pending',
        subscriptionStartDate: new Date().toISOString(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      },
    })

    // Update business registration status
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'payment_setup',
      },
    })

    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentBudgeting.id,
      message: 'Payment plan selected',
      nextStep: 'submission_confirmation',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Payment setup error:', error)
    return new Response(JSON.stringify({ error: 'Failed to setup payment plan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// 7. Complete Registration
export const completeRegistration = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { businessId } = body

    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update business details to completed
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'completed',
      },
    })

    // No user creation - partner accounts are separate from user accounts
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Registration completed successfully',
      businessId: businessId,
      // You can add additional partner portal info here
      partnerPortal: {
        message: 'You can now log in to the partner portal',
        // Add partner portal URL or next steps
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Complete registration error:', error)
    return new Response(JSON.stringify({ error: 'Failed to complete registration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// 8. Get Registration Status
export const getRegistrationStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const url = new URL(req.url || '')
    const businessId = url.pathname.split('/').pop()

    if (!businessId) {
      return new Response(JSON.stringify({ error: 'Business ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId,
      depth: 2,
    })

    if (!businessDetails) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get related data
    const adCampaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: {
        businessId: {
          equals: businessId,
        },
      },
    })

    const paymentBudgeting = await req.payload.find({
      collection: 'payment-budgeting',
      where: {
        businessId: {
          equals: businessId,
        },
      },
      limit: 1,
    })

    return new Response(JSON.stringify({
      success: true,
      businessDetails,
      adCampaigns: adCampaigns.docs,
      paymentPlan: paymentBudgeting.docs[0] || null,
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get status error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get registration status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
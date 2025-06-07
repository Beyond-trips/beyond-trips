

// endpoints/partnerRegistration.ts

import crypto from 'crypto'
import type { PayloadRequest } from 'payload'
import { sendOTPEmail } from '../lib/email'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getPayload } from 'payload'
import config from '@payload-config'

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

export async function loginPartner(req: any): Promise<Response> {
  try {
    const body = await parseRequestBody(req)
    const { email, password } = body

    if (!email || !password) {
      return new Response(JSON.stringify({
        error: 'Email and password are required'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partners = await req.payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: email.toLowerCase()
        }
      }
    })

    if (!partners.docs.length) {
      return new Response(JSON.stringify({
        error: 'Invalid credentials'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partner = partners.docs[0]

    if (!partner.emailVerified || partner.registrationStatus !== 'completed') {
      return new Response(JSON.stringify({
        error: 'Account not verified. Please complete registration first.',
        requiresVerification: true
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isValidPassword = await bcrypt.compare(password, partner.password)
    
    if (!isValidPassword) {
      return new Response(JSON.stringify({
        error: 'Invalid credentials'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = jwt.sign(
      { 
        id: partner.id,
        email: partner.companyEmail,
        role: 'partner',
        partnerId: partner.id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    await req.payload.update({
      collection: 'business-details',
      id: partner.id,
      data: {
        lastLogin: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      token,
      partner: {
        id: partner.id,
        email: partner.companyEmail,
        companyName: partner.companyName,
        contact: partner.contact,
        industry: partner.industry,
        registrationStatus: partner.registrationStatus,
        createdAt: partner.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Login error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const logout = async (req: PayloadRequest): Promise<Response> => {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return new Response(JSON.stringify({
        error: 'No token provided'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
    
        // TO this:
    await req.payload.update({
      collection: 'business-details',
      id: decoded.id,
      data: {
        lastLogout: new Date().toISOString()  // ✅ This is correct
      }
    })
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Logout error:', error)
    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const me = async (req: PayloadRequest): Promise<Response> => {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return new Response(JSON.stringify({
        error: 'No token provided'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
    
    const partner = await req.payload.findByID({
      collection: 'business-details',
      id: decoded.id
    })

    if (!partner) {
      return new Response(JSON.stringify({
        error: 'Partner not found'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      partner: {
        id: partner.id,
        companyEmail: partner.companyEmail,
        companyName: partner.companyName,
        companyAddress: partner.companyAddress,
        contact: partner.contact,
        industry: partner.industry,
        emailVerified: partner.emailVerified,
        registrationStatus: partner.registrationStatus,
        registrationDate: partner.registrationDate,
        lastLogin: partner.lastLogin,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get partner info error:', error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response(JSON.stringify({
        error: 'Invalid token'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const updatePartnerProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return new Response(JSON.stringify({
        error: 'No token provided'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
    const body = await parseRequestBody(req)
    
    const {
      password,
      emailVerified,
      verificationCode,
      verificationCodeExpiry,
      registrationStatus,
      ...allowedUpdates
    } = body

    const updatedPartner = await req.payload.update({
      collection: 'business-details',
      id: decoded.id,
      data: allowedUpdates
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      partner: {
        id: updatedPartner.id,
        companyEmail: updatedPartner.companyEmail,
        companyName: updatedPartner.companyName,
        companyAddress: updatedPartner.companyAddress,
        contact: updatedPartner.contact,
        industry: updatedPartner.industry,
        updatedAt: updatedPartner.updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Update partner info error:', error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response(JSON.stringify({
        error: 'Invalid token'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const forgotPassword = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

    if (!email) {
      return new Response(JSON.stringify({
        error: 'Email is required'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partners = await req.payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: email.toLowerCase()
        }
      },
      limit: 1
    })

    if (partners.docs.length > 0) {
      const partner = partners.docs[0]

      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

      await req.payload.update({
        collection: 'business-details',
        id: partner.id,
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetTokenExpiry.toISOString()
        }
      })

      const resetUrl = `${process.env.FRONTEND_URL}/partners/reset-password?token=${resetToken}`
      
      console.log(`🔐 Password reset requested for: ${email}`)
      console.log(`🔗 Reset URL: ${resetUrl}`)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const verifyResetToken = async (req: PayloadRequest): Promise<Response> => {
  try {
    const url = new URL(req.url || '')
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Reset token is required'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partners = await req.payload.find({
      collection: 'business-details',
      where: {
        and: [
          {
            passwordResetToken: {
              equals: token
            }
          },
          {
            passwordResetExpiry: {
              greater_than: new Date()
            }
          }
        ]
      },
      limit: 1
    })

    if (partners.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired reset token'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Reset token is valid'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verify reset token error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const resetPassword = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { token, password, confirmPassword } = body

    if (!token || !password || !confirmPassword) {
      return new Response(JSON.stringify({
        error: 'Token, password, and confirm password are required'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (password !== confirmPassword) {
      return new Response(JSON.stringify({
        error: 'Passwords do not match'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({
        error: 'Password must be at least 8 characters long'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partners = await req.payload.find({
      collection: 'business-details',
      where: {
        and: [
          {
            passwordResetToken: {
              equals: token
            }
          },
          {
            passwordResetExpiry: {
              greater_than: new Date()
            }
          }
        ]
      },
      limit: 1
    })

    if (partners.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired reset token'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partner = partners.docs[0]

    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    await req.payload.update({
      collection: 'business-details',
      id: partner.id,
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Password reset successful for: ${partner.companyEmail}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Reset password error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
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

    // Validate password strength (optional but recommended)
    if (password.length < 8) {
      return new Response(JSON.stringify({ 
        error: 'Password must be at least 8 characters long' 
      }), {
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

    // Hash the password before storing
    console.log('🔐 Hashing password...')
    const saltRounds = 12 // Higher number = more secure but slower
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString()
    console.log(`🔐 Generated verification code: ${verificationCode}`)
    

    console.log('📝 Creating business details...')
    // Create business details with hashed password
    const businessDetails = await req.payload.create({
      collection: 'business-details',
      data: {
        companyEmail,
        password: hashedPassword,
        companyName,
        companyAddress,
        contact,
        industry,
        emailVerified: false,
        verificationCode,
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Convert to ISO string
        registrationStatus: 'pending',
        registrationDate: new Date().toISOString(), // Convert to ISO string
      } as any,
    })

    console.log('✅ Business details created:', businessDetails.id)

    // Send verification email here (if you have email service set up)
    // await sendVerificationEmail(companyEmail, verificationCode)
    const emailResult = await sendOTPEmail(companyEmail, verificationCode)

    return new Response(JSON.stringify({
      success: true,
      message: 'Registration started successfully. Please check your email for verification code.',
      businessId: businessDetails.id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Registration error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
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
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Convert to ISO string
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

    
   // Updated createAdCampaign function with proper relationship handling
   export const createAdCampaign = async (req: PayloadRequest): Promise<Response> => {
    try {
      console.log('🚀 Creating ad campaign...')
      const body = await parseRequestBody(req)
      console.log('📝 Campaign data received:', JSON.stringify(body, null, 2))
      
      const { businessId, campaignType, campaignName, campaignDescription } = body
  
      // Validate required fields
      if (!businessId) {
        console.log('❌ Missing businessId')
        return new Response(JSON.stringify({ error: 'Business ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
  
      if (!campaignType) {
        console.log('❌ Missing campaignType')
        return new Response(JSON.stringify({ error: 'Campaign type is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
  
      console.log('🔍 Looking up business details...')
      const businessDetails = await req.payload.findByID({
        collection: 'business-details',
        id: businessId,
      })
  
      if (!businessDetails) {
        console.log('❌ Business not found')
        return new Response(JSON.stringify({ error: 'Business not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
  
      if (!(businessDetails as any).emailVerified) {
        console.log('❌ Email not verified')
        return new Response(JSON.stringify({ error: 'Email must be verified first' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
  
      console.log('📊 Creating ad campaign record...')
      
      // Create ad campaign - businessId will be used as relationship
      const adCampaign = await req.payload.create({
        collection: 'ad-campaigns',
        data: {
          businessId: businessId, // This will create the relationship
          campaignType,
          campaignName: campaignName || `Campaign for ${(businessDetails as any).companyName}`,
          campaignDescription: campaignDescription || '',
          status: 'draft',
          // createdAt is handled automatically by the schema
        },
      })
  
      console.log('✅ Ad campaign created:', adCampaign.id)
  
      // Update business registration status
      console.log('📝 Updating business registration status...')
      await req.payload.update({
        collection: 'business-details',
        id: businessId,
        data: {
          registrationStatus: 'campaign_setup',
        },
      })
  
      console.log('✅ Campaign setup completed successfully')
      return new Response(JSON.stringify({
        success: true,
        campaignId: adCampaign.id,
        message: 'Ad campaign created successfully',
        nextStep: 'payment_setup',
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
      
    } catch (error) {
      console.error('❌ Ad campaign creation error:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create ad campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

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

export const setupPaymentBudgeting = async (req: PayloadRequest): Promise<Response> => {
  try {
    console.log('💳 Setting up payment plan...')
    const body = await parseRequestBody(req)
    console.log('📝 Payment data received:', JSON.stringify(body, null, 2))
    
    const { businessId, subscriptionPlanId, paymentMethod } = body

    // Enhanced validation with detailed error messages
    if (!businessId) {
      console.log('❌ Missing businessId')
      return new Response(JSON.stringify({ 
        error: 'Business ID is required',
        field: 'businessId',
        received: body
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!subscriptionPlanId) {
      console.log('❌ Missing subscriptionPlanId')
      return new Response(JSON.stringify({ 
        error: 'Subscription plan is required',
        field: 'subscriptionPlanId',
        received: body
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify business exists first
    console.log('🔍 Looking up business details for ID:', businessId)
    let businessDetails
    try {
      businessDetails = await req.payload.findByID({
        collection: 'business-details',
        id: businessId,
      })
      console.log('✅ Business found:', { id: businessDetails.id, name: businessDetails.companyName })
    } catch (businessError) {
      console.log('❌ Business lookup failed:', businessError)
      return new Response(JSON.stringify({ 
        error: 'Business not found or invalid ID',
        businessId: businessId,
        details: businessError instanceof Error ? businessError.message : 'Unknown error'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Enhanced subscription plan lookup with better error handling
    console.log('📋 Looking up subscription plan for ID/Type:', subscriptionPlanId)
    let subscriptionPlan
    let pricingTier: 'starter' | 'standard' | 'pro' = 'starter'
    
    try {
      // Method 1: Try finding by exact ID (if subscriptionPlanId is an actual ID)
      if (subscriptionPlanId.length > 10) { // IDs are usually longer
        try {
          subscriptionPlan = await req.payload.findByID({
            collection: 'subscription-plans',
            id: subscriptionPlanId,
          })
          console.log('✅ Found plan by ID:', {
            id: subscriptionPlan.id,
            planName: (subscriptionPlan as any).planName,
            planType: (subscriptionPlan as any).planType,
            price: (subscriptionPlan as any).price
          })
          
          // Map planType to pricingTier and get price
          const planType = (subscriptionPlan as any).planType?.toLowerCase()
          const planPrice = (subscriptionPlan as any).price || 0
          console.log('📊 Plan details:', { type: planType, price: planPrice })
          
          if (planType === 'starter') pricingTier = 'starter'
          else if (planType === 'standard') pricingTier = 'standard'
          else if (planType === 'pro') pricingTier = 'pro'
          else {
            console.log('⚠️ Unknown plan type, defaulting to starter')
            pricingTier = 'starter'
          }
          
        } catch (planByIdError) {
          console.log('❌ Plan lookup by ID failed, trying by planType...')
          throw planByIdError // Will be caught by outer try-catch
        }
      } else {
        // Method 2: subscriptionPlanId is likely a planType (starter/standard/pro)
        console.log('🔍 Treating subscriptionPlanId as planType:', subscriptionPlanId)
        
        const plansByType = await req.payload.find({
          collection: 'subscription-plans',
          where: {
            and: [
              {
                planType: {
                  equals: subscriptionPlanId.toLowerCase()
                }
              },
              {
                isActive: {
                  equals: true
                }
              }
            ]
          },
          limit: 1
        })
        
        if (plansByType.docs.length > 0) {
          subscriptionPlan = plansByType.docs[0]
          pricingTier = subscriptionPlanId.toLowerCase() as 'starter' | 'standard' | 'pro'
          console.log('✅ Found subscription plan by type:', {
            id: subscriptionPlan.id,
            planName: (subscriptionPlan as any).planName,
            planType: (subscriptionPlan as any).planType,
            price: (subscriptionPlan as any).price
          })
        } else {
          throw new Error(`No active subscription plan found for type: ${subscriptionPlanId}`)
        }
      }
      
      // If we still don't have a plan, try one more fallback
      if (!subscriptionPlan) {
        console.log('🔍 Final fallback: searching all plans...')
        const allPlans = await req.payload.find({
          collection: 'subscription-plans',
          where: {
            isActive: {
              equals: true
            }
          },
          limit: 100
        })
        
        console.log('📋 Available active plans:', allPlans.docs.map(plan => ({
          id: plan.id,
          planName: (plan as any).planName,
          planType: (plan as any).planType,
          price: (plan as any).price,
          isActive: (plan as any).isActive
        })))
        
        // Try to find by planName or planType
        const foundPlan = allPlans.docs.find(plan => 
          (plan as any).planType?.toLowerCase() === subscriptionPlanId.toLowerCase() ||
          (plan as any).planName?.toLowerCase().includes(subscriptionPlanId.toLowerCase()) ||
          plan.id === subscriptionPlanId
        )
        
        if (foundPlan) {
          subscriptionPlan = foundPlan
          pricingTier = (foundPlan as any).planType?.toLowerCase() as 'starter' | 'standard' | 'pro'
          console.log('✅ Found plan via fallback search:', subscriptionPlan)
        } else {
          return new Response(JSON.stringify({ 
            error: 'Subscription plan not found',
            searchedFor: subscriptionPlanId,
            availablePlans: allPlans.docs.map(plan => ({
              id: plan.id,
              planName: (plan as any).planName,
              planType: (plan as any).planType,
              price: (plan as any).price,
              currency: (plan as any).currency,
              isActive: (plan as any).isActive
            })),
            suggestion: 'Use one of the planType values (starter, standard, pro) or the actual plan ID'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    } catch (planLookupError) {
      console.error('❌ Complete plan lookup failure:', planLookupError)
      
      // List all available plans for debugging
      try {
        const allPlans = await req.payload.find({
          collection: 'subscription-plans',
          limit: 100
        })
        
        return new Response(JSON.stringify({ 
          error: 'Failed to find subscription plan',
          searchedFor: subscriptionPlanId,
          details: planLookupError instanceof Error ? planLookupError.message : 'Unknown error',
          availablePlans: allPlans.docs.map(plan => ({
            id: plan.id,
            planName: (plan as any).planName,
            planType: (plan as any).planType,
            price: (plan as any).price,
            currency: (plan as any).currency,
            isActive: (plan as any).isActive
          })),
          suggestion: 'Use planType (starter/standard/pro) or the exact plan ID from the list above'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (listError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to lookup subscription plans',
          details: planLookupError instanceof Error ? planLookupError.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    console.log(`📊 Final pricing tier selected: ${pricingTier}`)

    // Get the price from the subscription plan
    const monthlyPrice = (subscriptionPlan as any).price || 0
    console.log(`💰 Monthly price from plan: ₦${monthlyPrice}`)

    // Check if payment budgeting already exists for this business
    console.log('🔍 Checking for existing payment budgeting...')
    const existingPayment = await req.payload.find({
      collection: 'payment-budgeting',
      where: {
        businessId: {
          equals: businessId
        }
      },
      limit: 1
    })

    if (existingPayment.docs.length > 0) {
      console.log('⚠️ Payment budgeting already exists, updating instead...')
      const updatedPayment = await req.payload.update({
        collection: 'payment-budgeting',
        id: existingPayment.docs[0].id,
        data: {
          pricingTier,
          monthlyBudget: monthlyPrice,
          paymentMethod: paymentMethod as 'card' | 'bank_transfer' | 'mobile_money' | undefined,
          paymentStatus: 'pending' as 'pending',
          subscriptionStartDate: new Date().toISOString(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      
      console.log('✅ Payment budgeting updated:', updatedPayment.id)
      
      return new Response(JSON.stringify({
        success: true,
        paymentId: updatedPayment.id,
        message: 'Payment plan updated successfully',
        action: 'updated',
        selectedPlan: {
          id: subscriptionPlan.id,
          planName: (subscriptionPlan as any).planName,
          planType: (subscriptionPlan as any).planType,
          pricingTier: pricingTier,
          price: monthlyPrice,
          currency: (subscriptionPlan as any).currency
        },
        nextStep: 'submission_confirmation',
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create new payment budgeting record
    console.log('💰 Creating new payment budgeting record...')
    console.log('Data to create:', {
      businessId: businessId,
      pricingTier,
      monthlyBudget: monthlyPrice,
      paymentMethod: paymentMethod,
      paymentStatus: 'pending',
    })

    let paymentBudgeting
    try {
      paymentBudgeting = await req.payload.create({
        collection: 'payment-budgeting',
        data: {
          businessId: businessId,
          pricingTier,
          monthlyBudget: monthlyPrice,
          paymentMethod: paymentMethod as 'card' | 'bank_transfer' | 'mobile_money' | undefined,
          paymentStatus: 'pending' as 'pending',
          subscriptionStartDate: new Date().toISOString(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      console.log('✅ Payment budgeting created successfully:', paymentBudgeting.id)
    } catch (createError) {
      console.error('❌ Failed to create payment budgeting:', createError)
      
      // Check if it's a validation error
      if (createError instanceof Error && createError.message.includes('validation')) {
        return new Response(JSON.stringify({ 
          error: 'Validation failed when creating payment record',
          details: createError.message,
          data: {
            businessId: businessId,
            pricingTier,
            monthlyBudget: monthlyPrice,
            paymentMethod: paymentMethod,
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      throw createError // Re-throw if it's not a validation error
    }

    // Update business registration status
    console.log('📝 Updating business registration status...')
    try {
      await req.payload.update({
        collection: 'business-details',
        id: businessId,
        data: {
          registrationStatus: 'payment_setup',
        },
      })
      console.log('✅ Business status updated to payment_setup')
    } catch (updateError) {
      console.error('⚠️ Failed to update business status:', updateError)
      // Don't fail the whole operation for this
    }

    console.log('✅ Payment setup completed successfully')
    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentBudgeting.id,
      message: 'Payment plan selected successfully',
      action: 'created',
      selectedPlan: {
        id: subscriptionPlan.id,
        planName: (subscriptionPlan as any).planName,
        planType: (subscriptionPlan as any).planType,
        pricingTier: pricingTier,
        price: monthlyPrice,
        currency: (subscriptionPlan as any).currency
      },
      businessDetails: {
        id: businessDetails.id,
        name: businessDetails.companyName
      },
      nextStep: 'submission_confirmation',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ Payment setup error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    // Enhanced error response
    let errorMessage = 'Failed to setup payment plan'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        errorMessage = 'Validation error in payment setup'
        statusCode = 400
      } else if (error.message.includes('not found')) {
        errorMessage = 'Required resource not found'
        statusCode = 404
      } else if (error.message.includes('duplicate')) {
        errorMessage = 'Payment plan already exists for this business'
        statusCode = 409
      }
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString(),
      message: 'Check the logs above for detailed debugging information'
    }), {
      status: statusCode,
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
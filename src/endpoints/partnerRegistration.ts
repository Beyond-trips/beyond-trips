

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

    console.log(`🔐 Password reset OTP requested for: ${email}`)

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
      
      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString()
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      // Store OTP in verificationCode field
      await req.payload.update({
        collection: 'business-details',
        id: partner.id,
        data: {
          verificationCode: otp,
          verificationCodeExpiry: otpExpiry.toISOString(),
          // Clear any old reset tokens
          passwordResetToken: null,
          passwordResetExpiry: null
        }
      })

      console.log(`🔐 Generated OTP for ${email}: ${otp}`)

      // Send OTP email (NOT password reset email!)
      try {
        const emailResult = await sendOTPEmail(email, otp)
        
        if (emailResult.success) {
          console.log(`✅ Password reset OTP sent to: ${email}`)
          console.log(`📧 Message ID: ${emailResult.messageId}`)
        } else {
          console.error('❌ Failed to send OTP email:', emailResult.error)
        }
      } catch (emailError) {
        console.error('❌ Email service error:', emailError)
      }
    } else {
      console.log(`⚠️ No partner found with email: ${email}`)
    }

    // Always return success for security
    return new Response(JSON.stringify({
      success: true,
      message: 'If an account with that email exists, an OTP has been sent to reset your password.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Forgot password error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const verifyPasswordResetOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email, otp } = body

    if (!email || !otp) {
      return new Response(JSON.stringify({
        error: 'Email and OTP are required'
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
            companyEmail: {
              equals: email.toLowerCase()
            }
          },
          {
            verificationCode: {
              equals: otp
            }
          },
          {
            verificationCodeExpiry: {
              greater_than: new Date()
            }
          }
        ]
      },
      limit: 1
    })

    if (partners.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired OTP'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // OTP is valid - generate a temporary token for password reset
    const partner = partners.docs[0]
    const tempToken = crypto.randomBytes(32).toString('hex')
    
    // Store temp token with 5 minute expiry
    await req.payload.update({
      collection: 'business-details',
      id: partner.id,
      data: {
        passwordResetToken: tempToken,
        passwordResetExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'OTP verified successfully',
      resetToken: tempToken // Frontend will use this for the actual reset
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verify OTP error:', error)
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
        verificationCode: null, // Clear the OTP
        verificationCodeExpiry: null,
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


// resend verification code for reset password 
export const resendPartnerResetOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find partner by companyEmail
    const partners = await req.payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: email.toLowerCase()
        }
      },
      limit: 1
    })

    if (partners.docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Partner not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const partner = partners.docs[0]

    // Generate reset OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Update partner with reset code
    await req.payload.update({
      collection: 'business-details',
      id: partner.id,
      data: {
        verificationCode,
        verificationCodeExpiry,
        passwordResetToken: null,
        passwordResetExpiry: null
      }
    })

    // Send email
    const result = await sendOTPEmail(partner.companyEmail, verificationCode)

    return new Response(JSON.stringify({
      success: true,
      message: result.success 
        ? 'Reset OTP sent to your email' 
        : 'OTP generated but email sending failed',
      emailSent: result.success
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Partner reset OTP resend error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
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
    const body = await parseRequestBody(req)
    const { businessId, subscriptionPlanId } = body

    if (!businessId || !subscriptionPlanId) {
      return new Response(JSON.stringify({ 
        error: 'Business ID and subscription plan are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get plan name
    const plan = await req.payload.findByID({
      collection: 'subscription-plans',
      id: subscriptionPlanId,
    })

    const planName = plan ? (plan as any).planName : 'Unknown Plan'

    // Save it
    const result = await req.payload.create({
      collection: 'payment-budgeting',
      data: {
        businessId: businessId,
        selectedPlan: planName,
      } as any,
    })

    return new Response(JSON.stringify({
      success: true,
      paymentId: result.id,
      selectedPlan: planName
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to setup payment plan'
    }), {
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
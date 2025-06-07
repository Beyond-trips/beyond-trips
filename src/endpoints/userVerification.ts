// endpoints/userVerification.ts

import crypto from 'crypto'
import type { PayloadRequest } from 'payload'

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

// Generate OTP and send to user
// Generate OTP and send to user
export const generateUserOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body
    
    console.log('🔍 Generating OTP for user email:', email)
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Find user by email
    console.log('📧 Looking up user with email:', email)
    const users = await req.payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })
    
    console.log('👥 Found users:', users.docs.length)
    
    if (users.docs.length === 0) {
      console.log('❌ User not found for email:', email)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const user = users.docs[0] as any
    console.log('👤 Found user:', { id: user.id, email: user.email, emailVerified: user.emailVerified })
    
    // Check if user is already verified
    if (user.emailVerified) {
      console.log('✅ Email already verified for user:', user.email)
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry
    
    console.log(`🔐 Generated OTP for ${email}: ${otp}`)
    console.log('⏰ OTP expires at:', otpExpiry)
    
    // Update user with new OTP
    console.log('💾 Updating user with OTP...')
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        otp,
        otpExpiry,
      },
    })
    
    console.log('✅ User updated with OTP')
    
    // Send OTP email using the same function that works for partners
    console.log('📧 Sending OTP email...')
    try {
      const { sendOTPEmail } = await import('../lib/email')
      const emailResult = await sendOTPEmail(email, otp)
      
      console.log('📧 Email send result:', emailResult)
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Verification code sent to your email',
        emailSent: emailResult.success,
        // In development, you might want to include the OTP
        ...(process.env.NODE_ENV === 'development' && { otp, debug: 'OTP included for development' }),
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError)
      
      // Still return success but indicate email issue
      return new Response(JSON.stringify({
        success: true,
        message: 'OTP generated but email sending failed',
        emailSent: false,
        // In development, include the OTP so testing can continue
        ...(process.env.NODE_ENV === 'development' && { otp, debug: 'Email failed - OTP for testing' }),
        error: 'Email service temporarily unavailable'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('❌ Generate OTP error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to generate verification code',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
// Verify OTP for regular users
export const verifyUserOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email, otp } = body

    if (!email || !otp) {
      return new Response(JSON.stringify({ error: 'Email and verification code are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find user by email
    const users = await req.payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (users.docs.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = users.docs[0] as any

    // Check if already verified
    if (user.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if OTP exists and hasn't expired
    if (!user.otp || !user.otpExpiry) {
      return new Response(JSON.stringify({ error: 'No verification code found. Please request a new code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (new Date() > new Date(user.otpExpiry)) {
      return new Response(JSON.stringify({ error: 'Verification code has expired. Please request a new code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // OTP is valid - verify the user
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        emailVerified: true,
        otp: null, // Clear the OTP
        otpExpiry: null,
      },
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        username: user.username,
        role: user.role,
      },
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const resendUserOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

    console.log('🔄 Resending OTP for user email:', email)

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find user by email
    console.log('📧 Looking up user for resend:', email)
    const users = await req.payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (users.docs.length === 0) {
      console.log('❌ User not found for resend:', email)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = users.docs[0] as any
    console.log('👤 Found user for resend:', { id: user.id, email: user.email, emailVerified: user.emailVerified })

    if (user.emailVerified) {
      console.log('✅ Email already verified, no resend needed')
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry

    console.log(`🔐 Generated new OTP for ${email}: ${otp}`)

    // Update user with new OTP
    console.log('💾 Updating user with new OTP...')
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        otp,
        otpExpiry,
      },
    })

    console.log('✅ User updated with new OTP')

    // Send OTP email
    console.log('📧 Sending resend OTP email...')
    try {
      const { sendOTPEmail } = await import('../lib/email')
      const emailResult = await sendOTPEmail(email, otp)

      console.log('📧 Resend email result:', emailResult)

      return new Response(JSON.stringify({
        success: true,
        message: 'New verification code sent to your email',
        emailSent: emailResult.success,
        ...(process.env.NODE_ENV === 'development' && { otp, debug: 'OTP included for development' }),
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (emailError) {
      console.error('❌ Resend email failed:', emailError)
      
      return new Response(JSON.stringify({
        success: true,
        message: 'OTP generated but email sending failed',
        emailSent: false,
        ...(process.env.NODE_ENV === 'development' && { otp, debug: 'Email failed - OTP for testing' }),
        error: 'Email service temporarily unavailable'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('❌ Resend OTP error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to resend verification code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get user's onboarding status
export const getUserOnboardingStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔍 Getting onboarding status for user:', user.id)

    // Get onboarding record
    const onboardingRecords = await req.payload.find({
      collection: 'user-onboarding',
      where: {
        userId: {
          equals: user.id
        }
      },
      limit: 1
    })

    let onboardingRecord = onboardingRecords.docs[0]

    // Create onboarding record if it doesn't exist
    if (!onboardingRecord) {
      console.log('📝 Creating new onboarding record')
      onboardingRecord = await req.payload.create({
        collection: 'user-onboarding',
        data: {
          userId: user.id,
          currentStep: 'basic_details' as 'basic_details',
          onboardingStatus: 'in_progress' as 'in_progress',
          stepsCompleted: [],
          startedAt: new Date().toISOString()
        }
      })
    }

    // Get related data
    const [documents, bankDetails, training] = await Promise.all([
      req.payload.find({
        collection: 'user-documents',
        where: { userId: { equals: user.id } }
      }),
      req.payload.find({
        collection: 'user-bank-details',
        where: { userId: { equals: user.id } },
        limit: 1
      }),
      req.payload.find({
        collection: 'user-training',
        where: { userId: { equals: user.id } },
        limit: 1
      })
    ])

    return new Response(JSON.stringify({
      success: true,
      onboarding: onboardingRecord,
      documents: documents.docs,
      bankDetails: bankDetails.docs[0] || null,
      training: training.docs[0] || null,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        address: user.address,
        references: user.references
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get onboarding status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get onboarding status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


// Upload documents (Step 2)
export const uploadUserDocuments = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📁 Uploading documents for user:', user.id)
    console.log('📝 Document data:', JSON.stringify(body, null, 2))

    const { documents } = body

    if (!documents || !Array.isArray(documents)) {
      return new Response(JSON.stringify({
        error: 'Documents array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const uploadedDocs = []

    // Upload each document
    for (const doc of documents) {
      const { documentType, mediaId } = doc

      if (!documentType || !mediaId) {
        continue
      }

      // Check if document type already exists for this user
      const existingDocs = await req.payload.find({
        collection: 'user-documents',
        where: {
          and: [
            { userId: { equals: user.id } },
            { documentType: { equals: documentType } }
          ]
        }
      })

      if (existingDocs.docs.length > 0) {
        // Update existing document
        const updatedDoc = await req.payload.update({
          collection: 'user-documents',
          id: existingDocs.docs[0].id,
          data: {
            documentFile: mediaId,
            verificationStatus: 'pending' as 'pending',
            uploadedAt: new Date().toISOString()
          }
        })
        uploadedDocs.push(updatedDoc)
      } else {
        // Create new document record
        const newDoc = await req.payload.create({
          collection: 'user-documents',
          data: {
            userId: user.id,
            documentType: documentType as 'drivers_license' | 'national_id' | 'vehicle_registration',
            documentFile: mediaId,
            verificationStatus: 'pending' as 'pending',
            uploadedAt: new Date().toISOString()
          }
        })
        uploadedDocs.push(newDoc)
      }
    }

    // Update onboarding status
    await updateOnboardingStep(req, user.id, 'document_upload')

    return new Response(JSON.stringify({
      success: true,
      message: 'Documents uploaded successfully',
      documents: uploadedDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload documents error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload documents'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Save bank details (Step 3)
export const saveUserBankDetails = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🏦 Saving bank details for user:', user.id)

    const { bankName, accountName, accountNumber } = body

    if (!bankName || !accountName || !accountNumber) {
      return new Response(JSON.stringify({
        error: 'Bank name, account name, and account number are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate account number
    if (accountNumber.length !== 10) {
      return new Response(JSON.stringify({
        error: 'Account number must be 10 digits'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if bank details already exist for this user
    const existingBankDetails = await req.payload.find({
      collection: 'user-bank-details',
      where: {
        userId: { equals: user.id }
      }
    })

    let bankDetailsRecord

    if (existingBankDetails.docs.length > 0) {
      // Update existing bank details
      bankDetailsRecord = await req.payload.update({
        collection: 'user-bank-details',
        id: existingBankDetails.docs[0].id,
        data: {
          bankName: bankName as any, // Type assertion for your bank options
          accountName,
          accountNumber,
          verificationStatus: 'pending' as 'pending'
        }
      })
    } else {
      // Create new bank details record
      bankDetailsRecord = await req.payload.create({
        collection: 'user-bank-details',
        data: {
          userId: user.id,
          bankName: bankName as any, // Type assertion for your bank options
          accountName,
          accountNumber,
          verificationStatus: 'pending' as 'pending'
        }
      })
    }

    // Update onboarding status
    await updateOnboardingStep(req, user.id, 'bank_payment')

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank details saved successfully',
      bankDetails: bankDetailsRecord
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Save bank details error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save bank details'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Complete training (Step 4)
export const completeUserTraining = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🎓 Completing training for user:', user.id)

    const { trainingVideos, termsAccepted } = body

    if (!termsAccepted) {
      return new Response(JSON.stringify({
        error: 'Terms and conditions must be accepted'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if training record exists
    const existingTraining = await req.payload.find({
      collection: 'user-training',
      where: {
        userId: { equals: user.id }
      }
    })

    const trainingData = {
      userId: user.id,
      trainingVideos: trainingVideos || [],
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      trainingCompleted: true,
      trainingCompletedAt: new Date().toISOString()
    }

    let trainingRecord

    if (existingTraining.docs.length > 0) {
      // Update existing training record
      trainingRecord = await req.payload.update({
        collection: 'user-training',
        id: existingTraining.docs[0].id,
        data: trainingData
      })
    } else {
      // Create new training record
      trainingRecord = await req.payload.create({
        collection: 'user-training',
        data: trainingData
      })
    }

    // Update onboarding status
    await updateOnboardingStep(req, user.id, 'training')

    return new Response(JSON.stringify({
      success: true,
      message: 'Training completed successfully',
      training: trainingRecord
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Complete training error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to complete training'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Complete onboarding (Step 5)
export const completeUserOnboarding = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🎉 Completing onboarding for user:', user.id)

    // Verify all steps are completed
    const [documents, bankDetails, training] = await Promise.all([
      req.payload.find({
        collection: 'user-documents',
        where: { userId: { equals: user.id } }
      }),
      req.payload.find({
        collection: 'user-bank-details',
        where: { userId: { equals: user.id } }
      }),
      req.payload.find({
        collection: 'user-training',
        where: { userId: { equals: user.id } }
      })
    ])

    // Check if all required documents are uploaded
    const requiredDocTypes = ['drivers_license', 'national_id', 'vehicle_registration']
    const uploadedDocTypes = documents.docs.map((doc: any) => doc.documentType)
    const missingDocs = requiredDocTypes.filter(type => !uploadedDocTypes.includes(type))

    if (missingDocs.length > 0) {
      return new Response(JSON.stringify({
        error: 'Missing required documents',
        missingDocuments: missingDocs
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (bankDetails.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Bank details not provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (training.docs.length === 0 || !training.docs[0].trainingCompleted) {
      return new Response(JSON.stringify({
        error: 'Training not completed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update onboarding to completed
    const onboardingRecord = await updateOnboardingStep(req, user.id, 'completed')

    // Update final status
    await req.payload.update({
      collection: 'user-onboarding',
      id: onboardingRecord.id,
      data: {
        onboardingStatus: 'pending_review' as 'pending_review',
        completedAt: new Date().toISOString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Onboarding completed successfully! Your account is now under review.',
      onboarding: onboardingRecord
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Complete onboarding error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to complete onboarding'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


// User forgot password
export const userForgotPassword = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

    console.log('🔐 User forgot password request for:', email)

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find user by email
    const users = await req.payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email.toLowerCase()
        }
      },
      limit: 1
    })

    // Always return success to prevent email enumeration attacks
    // But only send email if user exists
    if (users.docs.length > 0) {
      const user = users.docs[0] as any

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Save reset token to database
      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetTokenExpiry.toISOString()
        }
      })

      // Send password reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      
      console.log(`🔐 Password reset requested for: ${email}`)
      console.log(`🔗 Reset URL: ${resetUrl}`)
      
      try {
        const { sendPasswordResetEmail } = await import('../lib/email')
        const emailResult = await sendPasswordResetEmail(email, resetUrl, user.firstName || 'User')
        
        console.log('📧 Password reset email result:', emailResult)
      } catch (emailError) {
        console.error('❌ Password reset email failed:', emailError)
        // Continue anyway - user won't know if email failed
      }
    }

    // Always return the same response regardless of whether email exists
    return new Response(JSON.stringify({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('User forgot password error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Verify reset token (optional endpoint to check if token is valid)
export const verifyUserResetToken = async (req: PayloadRequest): Promise<Response> => {
  try {
    const url = new URL(req.url || '')
    const token = url.searchParams.get('token')

    console.log('🔍 Verifying user reset token:', token)

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Reset token is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find user with this reset token
    const users = await req.payload.find({
      collection: 'users',
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

    if (users.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired reset token'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = users.docs[0] as any

    return new Response(JSON.stringify({
      success: true,
      message: 'Reset token is valid',
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
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

// Reset user password
export const userResetPassword = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { token, password, confirmPassword } = body

    console.log('🔐 User password reset with token:', token)

    // Validate required fields
    if (!token || !password || !confirmPassword) {
      return new Response(JSON.stringify({
        error: 'Token, password, and confirm password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate password match
    if (password !== confirmPassword) {
      return new Response(JSON.stringify({
        error: 'Passwords do not match'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate password strength
    if (password.length < 8) {
      return new Response(JSON.stringify({
        error: 'Password must be at least 8 characters long'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find user with valid reset token
    const users = await req.payload.find({
      collection: 'users',
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

    if (users.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired reset token'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = users.docs[0] as any

    // Hash new password (Payload will handle this automatically)
    // Update password and clear reset token
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password: password, // Payload will hash this automatically
        passwordResetToken: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Password reset successful for: ${user.email}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
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

// Update user profile (basic info during onboarding)
export const updateUserProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('👤 Updating profile for user:', user.id)
    console.log('📝 Profile data:', JSON.stringify(body, null, 2))

    const {
      firstName,
      lastName,
      phoneNumber,
      address,
      references
    } = body

    // Validate required fields
    if (!firstName || !lastName || !phoneNumber) {
      return new Response(JSON.stringify({
        error: 'First name, last name, and phone number are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update user profile
    const updatedUser = await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        firstName,
        lastName,
        phoneNumber,
        address,
        references
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
        address: updatedUser.address,
        references: updatedUser.references
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Helper function to update onboarding step
async function updateOnboardingStep(req: PayloadRequest, userId: string, step: 'basic_details' | 'document_upload' | 'bank_payment' | 'training' | 'completed') {
  const onboardingRecords = await req.payload.find({
    collection: 'user-onboarding',
    where: {
      userId: { equals: userId }
    }
  })

  let onboardingRecord = onboardingRecords.docs[0]

  if (!onboardingRecord) {
    // Create new onboarding record
    onboardingRecord = await req.payload.create({
      collection: 'user-onboarding',
      data: {
        userId,
        currentStep: step,
        onboardingStatus: 'in_progress' as 'in_progress',
        stepsCompleted: [{ step, completedAt: new Date().toISOString() }],
        startedAt: new Date().toISOString()
      }
    })
  } else {
    // Update existing record
    const existingSteps = onboardingRecord.stepsCompleted || []
    const stepExists = existingSteps.some((s: any) => s.step === step)
    
    const updatedSteps = stepExists 
      ? existingSteps 
      : [...existingSteps, { step, completedAt: new Date().toISOString() }]

    onboardingRecord = await req.payload.update({
      collection: 'user-onboarding',
      id: onboardingRecord.id,
      data: {
        currentStep: step,
        stepsCompleted: updatedSteps
      }
    })
  }

  return onboardingRecord
}
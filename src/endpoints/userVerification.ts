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
export const generateUserOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

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

    // Check if user is already verified
    if (user.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry

    // Update user with new OTP
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        otp,
        otpExpiry,
      },
    })

    // TODO: Send OTP email here
    console.log(`🔐 Generated OTP for ${email}: ${otp}`)
    // await sendOTPEmail(email, otp)

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification code sent to your email',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Generate OTP error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate verification code' }), {
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

// Resend OTP for regular users
export const resendUserOTP = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await parseRequestBody(req)
    const { email } = body

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

    if (user.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry

    // Update user with new OTP
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        otp,
        otpExpiry,
      },
    })

    // TODO: Send OTP email here
    console.log(`🔐 Resent OTP for ${email}: ${otp}`)
    // await sendOTPEmail(email, otp)

    return new Response(JSON.stringify({
      success: true,
      message: 'New verification code sent to your email',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return new Response(JSON.stringify({ error: 'Failed to resend verification code' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
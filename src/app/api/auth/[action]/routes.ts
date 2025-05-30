// src/app/api/auth/[action]/route.ts
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action
  const payload = await getPayload({ config })

  if (action === 'generate-otp') {
    try {
      const body = await req.json()
      const { email } = body

      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      // Check if user exists
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      let user
      if (users.docs.length === 0) {
        // Create new user
        user = await payload.create({
          collection: 'users',
          data: {
            email,
            password: 'TempPassword123!',
            username: email.split('@')[0],
            role: 'user',
            emailVerified: false,
          },
        })
      } else {
        user = users.docs[0]
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

      // Update user with OTP
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          otp,
          otpExpiry: otpExpiry.toISOString(),
        },
      })

      // Import email function
      const { sendOTPEmail } = await import('../../../../lib/email')
      const emailResult = await sendOTPEmail(email, otp)

      return NextResponse.json({
        success: true,
        message: emailResult.success 
          ? 'OTP sent to your email successfully' 
          : 'OTP generated but email sending failed',
        userId: user.id,
        emailSent: emailResult.success,
        otp: otp // Remove in production
      })
    } catch (error) {
      console.error('Error in generate-otp:', error)
      return NextResponse.json({ 
        error: 'Failed to generate OTP',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }

  if (action === 'verify-otp') {
    try {
      const body = await req.json()
      const { email, otp } = body

      if (!email || !otp) {
        return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      // Find user
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })

      if (users.docs.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 400 })
      }

      const user = users.docs[0]

      // Check OTP
      if (!user.otp || user.otp !== otp) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
      }

      // Check expiry
      if (!user.otpExpiry || new Date(user.otpExpiry) <= new Date()) {
        return NextResponse.json({ error: 'OTP has expired' }, { status: 400 })
      }

      // Clear OTP and mark as verified
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          otp: null,
          otpExpiry: null,
          emailVerified: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      })
    } catch (error) {
      console.error('Error in verify-otp:', error)
      return NextResponse.json({ 
        error: 'Failed to verify OTP',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
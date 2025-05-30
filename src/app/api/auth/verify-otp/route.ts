// src/app/api/auth/verify-otp/route.ts
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, otp } = body

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

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
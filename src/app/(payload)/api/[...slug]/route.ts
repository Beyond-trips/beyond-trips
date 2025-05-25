// src/app/(payload)/api/[...slug]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../payload.config'

// Create a universal handler that routes to Payload operations
const handler = async (req: NextRequest) => {
 try {
   const payload = await getPayload({ config })
   const url = new URL(req.url)
   const pathname = url.pathname
   const searchParams = url.searchParams
   const method = req.method

   console.log(`${method} ${pathname}`)

   // Parse the path to determine the operation
   const pathParts = pathname.replace('/api/', '').split('/')
   const [firstPart, secondPart, thirdPart] = pathParts

   // Test email connection endpoint
   if (firstPart === 'test-email' && method === 'GET') {
     const { testEmailConnection } = await import('../../../../lib/email')
     const result = await testEmailConnection()
     return NextResponse.json(result)
   }

   // Handle different endpoint patterns
   if (firstPart === 'auth') {
     // Handle auth endpoints like /api/auth/generate-otp
     if (secondPart === 'generate-otp' && method === 'POST') {
       let body
       try {
         const rawBody = await req.text()
         console.log('Raw body:', rawBody)
         
         if (!rawBody || rawBody.trim() === '') {
           return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
         }
         
         body = JSON.parse(rawBody)
       } catch (error) {
         console.error('JSON parse error:', error)
         return NextResponse.json({ 
           error: 'Invalid JSON in request body',
           details: error instanceof Error ? error.message : 'Unknown parsing error'
         }, { status: 400 })
       }

       const { email } = body

       if (!email) {
         return NextResponse.json({ error: 'Email is required' }, { status: 400 })
       }

       // Find or create user
       const users = await payload.find({
         collection: 'users',
         where: { email: { equals: email } },
         limit: 1,
       })

       let user
       if (users.docs.length === 0) {
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
       const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

       // Update user with OTP
       await payload.update({
         collection: 'users',
         id: user.id,
         data: {
           otp,
           otpExpiry,
         },
       })

       // Send OTP via email
       const { sendOTPEmail } = await import('../../../../lib/email')
       const emailResult = await sendOTPEmail(email, otp)
       
       if (!emailResult.success) {
         console.error('Failed to send OTP email:', emailResult.error)
       }

       return NextResponse.json({
         success: true,
         message: emailResult.success 
           ? 'OTP sent to your email successfully' 
           : 'OTP generated but email sending failed',
         userId: user.id,
         emailSent: emailResult.success,
         otp: otp // Remove this in production!
       })
     }

     if (secondPart === 'verify-otp' && method === 'POST') {
       let body
       try {
         const rawBody = await req.text()
         console.log('Raw body:', rawBody)
         
         if (!rawBody || rawBody.trim() === '') {
           return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
         }
         
         body = JSON.parse(rawBody)
       } catch (error) {
         console.error('JSON parse error:', error)
         return NextResponse.json({ 
           error: 'Invalid JSON in request body',
           details: error instanceof Error ? error.message : 'Unknown parsing error'
         }, { status: 400 })
       }

       const { email, otp } = body

       if (!email || !otp) {
         return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
       }

       // First find the user by email only
       const users = await payload.find({
         collection: 'users',
         where: { email: { equals: email } },
         limit: 1,
       })

       if (users.docs.length === 0) {
         return NextResponse.json({ error: 'User not found' }, { status: 400 })
       }

       const user = users.docs[0]

       // Check OTP and expiry manually
       if (!user.otp || user.otp !== otp) {
         return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
       }

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
     }
   }

   // Handle collection operations
   if (method === 'GET') {
     if (secondPart && !thirdPart) {
       // GET /api/collection/id
       const result = await payload.findByID({
         collection: firstPart,
         id: secondPart,
       })
       return NextResponse.json(result)
     } else {
       // GET /api/collection with query params
       const limit = parseInt(searchParams.get('limit') || '10')
       const page = parseInt(searchParams.get('page') || '1')
       
       const result = await payload.find({
         collection: firstPart,
         limit,
         page,
       })
       return NextResponse.json(result)
     }
   }

   if (method === 'POST') {
     let body
     try {
       const rawBody = await req.text()
       if (!rawBody || rawBody.trim() === '') {
         return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
       }
       body = JSON.parse(rawBody)
     } catch (error) {
       console.error('JSON parse error:', error)
       return NextResponse.json({ 
         error: 'Invalid JSON in request body',
         details: error instanceof Error ? error.message : 'Unknown parsing error'
       }, { status: 400 })
     }

     const result = await payload.create({
       collection: firstPart,
       data: body,
     })
     return NextResponse.json(result)
   }

   if (method === 'PATCH' && secondPart) {
     let body
     try {
       const rawBody = await req.text()
       if (!rawBody || rawBody.trim() === '') {
         return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
       }
       body = JSON.parse(rawBody)
     } catch (error) {
       console.error('JSON parse error:', error)
       return NextResponse.json({ 
         error: 'Invalid JSON in request body',
         details: error instanceof Error ? error.message : 'Unknown parsing error'
       }, { status: 400 })
     }

     const result = await payload.update({
       collection: firstPart,
       id: secondPart,
       data: body,
     })
     return NextResponse.json(result)
   }

   if (method === 'DELETE' && secondPart) {
     const result = await payload.delete({
       collection: firstPart,
       id: secondPart,
     })
     return NextResponse.json(result)
   }

   // If no route matches
   return NextResponse.json({
     error: 'Endpoint not found',
     path: pathname,
     method: method
   }, { status: 404 })

 } catch (error) {
   console.error('API Error:', error)
   return NextResponse.json({
     error: 'Internal server error',
     message: error instanceof Error ? error.message : 'Unknown error'
   }, { status: 500 })
 }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

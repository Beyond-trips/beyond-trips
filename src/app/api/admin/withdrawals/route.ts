import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAllWithdrawals,
  updateWithdrawalStatus,
  getWithdrawalStats,
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal
} from '../../../../endpoints/adminWithdrawalEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('👨‍💼 Admin Withdrawal GET request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })

      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated via Payload:', user.email)
      } else {
        console.log('❌ No authenticated user found in Admin')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Admin auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payload request with authenticated user
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
    } as any

    switch (action) {
      case 'all':
        return await getAllWithdrawals(payloadRequest)
      
      case 'stats':
        return await getWithdrawalStats(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Withdrawal GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('👨‍💼 Admin Withdrawal POST request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })

      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated via Payload:', user.email)
      } else {
        console.log('❌ No authenticated user found in Admin')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Admin auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payload request with authenticated user
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body: await req.json()
    } as any

    switch (action) {
      case 'update-status':
        return await updateWithdrawalStatus(payloadRequest)
      
      case 'approve':
        return await approveWithdrawal(payloadRequest)
      
      case 'reject':
        return await rejectWithdrawal(payloadRequest)
      
      case 'complete':
        return await completeWithdrawal(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Withdrawal POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

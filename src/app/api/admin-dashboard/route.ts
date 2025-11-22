import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

// Import admin endpoint functions
import {
  getAdminDashboardOverview,
  getAdminStats,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getPendingBankRequests,
  approveBankDetails,
  rejectBankDetails,
  getPendingCampaigns,
  approveCampaign,
  rejectCampaign,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getPendingPayments,
  processRefund
} from '@/endpoints/adminDashboardEndpoints'

interface PayloadRequest extends NextRequest {
  payload?: any
  user?: any
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const payloadRequest = req as PayloadRequest
    payloadRequest.payload = payload

    // Use Payload's built-in authentication
    try {
      const authResponse = await payload.auth({ headers: req.headers })
      if (!authResponse.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      payloadRequest.user = authResponse.user
      console.log('✅ Admin auth success:', { 
        hasUser: !!payloadRequest.user, 
        role: payloadRequest.user?.role,
        id: payloadRequest.user?.id,
        email: payloadRequest.user?.email
      })
    } catch (e) {
      console.error('❌ Admin auth failed:', String(e))
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get action from query
    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'overview':
        return await getAdminDashboardOverview(payloadRequest)
      case 'stats':
        return await getAdminStats(payloadRequest)
      case 'getPendingWithdrawals':
        return await getPendingWithdrawals(payloadRequest)
      case 'getPendingBankRequests':
        return await getPendingBankRequests(payloadRequest)
      case 'getPendingCampaigns':
        return await getPendingCampaigns(payloadRequest)
      case 'getAllUsers':
        return await getAllUsers(payloadRequest)
      case 'getUserDetails':
        return await getUserDetails(payloadRequest)
      case 'getPendingPayments':
        return await getPendingPayments(payloadRequest)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('❌ Admin dashboard error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const payloadRequest = req as PayloadRequest
    payloadRequest.payload = payload

    // Use Payload's built-in authentication
    try {
      const authResponse = await payload.auth({ headers: req.headers })
      if (!authResponse.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      console.error('❌ Admin auth failed (POST):', String(e))
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get action from query
    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'approveWithdrawal':
        return await approveWithdrawal(payloadRequest)
      case 'rejectWithdrawal':
        return await rejectWithdrawal(payloadRequest)
      case 'approveBankDetails':
        return await approveBankDetails(payloadRequest)
      case 'rejectBankDetails':
        return await rejectBankDetails(payloadRequest)
      case 'approveCampaign':
        return await approveCampaign(payloadRequest)
      case 'rejectCampaign':
        return await rejectCampaign(payloadRequest)
      case 'updateUserStatus':
        return await updateUserStatus(payloadRequest)
      case 'processRefund':
        return await processRefund(payloadRequest)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('❌ Admin dashboard POST error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

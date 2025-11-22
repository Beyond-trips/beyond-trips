import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAdminDashboardOverview,
  getPendingCampaigns,
  getAllCampaigns,
  approveCampaign,
  rejectCampaign,
  getPendingApprovals,
  getRecentActivity,
  getUserStats,
  getCampaignStats,
  getFinancialStats,
  exportAnalytics,
  getSystemAnalytics
} from '../../../../endpoints/adminDashboardEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('📊 Admin Dashboard GET request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated:', user.email)
      } else {
        console.log('❌ No authenticated user found')
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

    // Create payload request
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
    } as any

    switch (action) {
      case 'overview':
        return await getAdminDashboardOverview(payloadRequest)
      
      case 'pending-campaigns':
        return await getPendingCampaigns(payloadRequest)
      
      case 'all-campaigns':
        return await getAllCampaigns(payloadRequest)
      
      case 'pending-approvals':
        return await getPendingApprovals(payloadRequest)
      
      case 'recent-activity':
        return await getRecentActivity(payloadRequest)
      
      case 'user-stats':
        return await getUserStats(payloadRequest)
      
      case 'campaign-stats':
        return await getCampaignStats(payloadRequest)
      
      case 'financial-stats':
        return await getFinancialStats(payloadRequest)
      
      case 'export-analytics':
        return await exportAnalytics(payloadRequest)
      
      case 'system-analytics':
        return await getSystemAnalytics(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Dashboard GET error:', error)
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

    console.log('📊 Admin Dashboard POST request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated:', user.email)
      } else {
        console.log('❌ No authenticated user found')
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

    // Parse request body
    const body = await req.json()

    // Create payload request
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body,
    } as any

    switch (action) {
      case 'approve-campaign':
        return await approveCampaign(payloadRequest)
      
      case 'reject-campaign':
        return await rejectCampaign(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Dashboard POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


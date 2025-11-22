import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAdminDashboardOverview,
  getPendingCampaigns,
  approveCampaign,
  rejectCampaign,
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
        // TODO: Implement getAllCampaigns function
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getAllCampaigns function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
      case 'pending-approvals':
        // TODO: Implement getPendingApprovals function (unified view of all pending items)
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getPendingApprovals function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
      case 'recent-activity':
        // TODO: Implement getRecentActivity function (query NotificationLogs collection)
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getRecentActivity function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
      case 'user-stats':
        // TODO: Implement getUserStats function (aggregated user statistics)
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getUserStats function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
      case 'campaign-stats':
        // TODO: Implement getCampaignStats function (detailed campaign performance)
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getCampaignStats function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
      case 'financial-stats':
        // TODO: Implement getFinancialStats function (dedicated financial reporting)
        return new Response(JSON.stringify({ 
          error: 'Not implemented yet',
          message: 'getFinancialStats function needs to be implemented'
        }), { status: 501, headers: { 'Content-Type': 'application/json' } })
      
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


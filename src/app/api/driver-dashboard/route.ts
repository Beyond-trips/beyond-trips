import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getDriverDashboardOverview,
  getDriverEarnings,
  getDriverRatings,
  getDriverNotifications,
  markNotificationAsRead,
  getDriverMagazines,
  markMagazineAsRead,
  addDriverScans,
  requestWithdrawal,
  getWithdrawalHistory,
  getDriverProfile,
  updateDriverProfile,
  requestBankDetailsUpdate,
  getBankDetailsRequests,
  requestMagazinePickup,
  getMagazinePickups,
  confirmMagazineReturn,
  getNotificationPreferences,
  updateNotificationPreferences,
  changePassword,
  scanMagazineBarcode,
  searchDriverEarnings,
  exportDriverEarnings
} from '../../../endpoints/driverDashboardEndpoints'
import { markNotificationsAsRead } from '../../../endpoints/driverNotificationEndpoints'
import { activateMagazine } from '../../../endpoints/driverMagazineActivationEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('🚗 Driver Dashboard GET request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
    const authResult = await payload.auth({
      headers: req.headers
    })
    
    if (authResult.user) {
      user = authResult.user
      console.log('✅ Driver Dashboard authenticated via Payload:', user.email)
    } else {
      console.log('❌ No authenticated user found in Driver Dashboard')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
    }
    } catch (error) {
      console.error('❌ Driver Dashboard auth error:', error)
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
    }

    // Parse request body (optional for GET requests)
    let body = null
    try {
      body = await req.json()
    } catch (error) {
      // GET requests may not have a body, which is fine
    }

    // Create payload request with authenticated user (matching working user onboarding pattern)
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body,
    } as any

    switch (action) {
      case 'overview':
        return await getDriverDashboardOverview(payloadRequest)
      
      case 'earnings':
        return await getDriverEarnings(payloadRequest as any)
      
      case 'ratings':
        return await getDriverRatings(payloadRequest as any)
      
      case 'notifications':
        return await getDriverNotifications(payloadRequest as any)
      
      case 'magazines':
        return await getDriverMagazines(payloadRequest as any)
      
      case 'profile':
        return await getDriverProfile(payloadRequest as any)
      
      case 'withdrawals':
        return await getWithdrawalHistory(payloadRequest as any)
      
      case 'bank-details-requests':
        return await getBankDetailsRequests(payloadRequest as any)
      
      case 'magazine-pickups':
        return await getMagazinePickups(payloadRequest as any)
      
      case 'notification-preferences':
        return await getNotificationPreferences(payloadRequest as any)
      
      case 'search-earnings':
        return await searchDriverEarnings(payloadRequest as any)
      
      case 'export-earnings':
        return await exportDriverEarnings(payloadRequest as any)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Driver Dashboard GET error:', error)
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

    console.log('🚗 Driver Dashboard POST request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({ 
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Driver Dashboard POST authenticated via Payload:', user.email)
      } else {
        console.log('❌ No authenticated user found in Driver Dashboard POST')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Driver Dashboard POST auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Handle mark-all-read separately (no body needed)
    if (action === 'mark-all-read') {
      const payloadRequest = {
        payload,
        headers: req.headers,
        url: req.url,
        method: req.method,
        user,
        body: { markAll: true },
        json: async () => ({ markAll: true })
      } as any
      return await markNotificationsAsRead(payloadRequest)
    }

    // Parse request body for other actions
    let body = {}
    try {
      const text = await req.text()
      body = text ? JSON.parse(text) : {}
    } catch (error) {
      // If body is empty or invalid, use empty object
      body = {}
    }

    // Create payload request with authenticated user (matching working user onboarding pattern)
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body,
    } as any

    switch (action) {
      
      case 'mark-notification-read':
        return await markNotificationAsRead(payloadRequest)
      
      case 'mark-magazine-read':
        return await markMagazineAsRead(payloadRequest as any)
      
      case 'update-profile':
        return await updateDriverProfile(payloadRequest as any)
      
      case 'add-scans':
        return await addDriverScans(payloadRequest as any)
      
      case 'request-withdrawal':
        return await requestWithdrawal(payloadRequest as any)
      
      case 'request-bank-update':
        return await requestBankDetailsUpdate(payloadRequest as any)
      
      case 'request-magazine-pickup':
        return await requestMagazinePickup(payloadRequest as any)
      
      case 'confirm-magazine-return':
        return await confirmMagazineReturn(payloadRequest as any)
      
      case 'update-notification-preferences':
        return await updateNotificationPreferences(payloadRequest as any)
      
      case 'change-password':
        return await changePassword(payloadRequest as any)
      
      case 'scan-magazine-barcode':
        return await scanMagazineBarcode(payloadRequest as any)
      
      case 'activate-magazine':
        return await activateMagazine(payloadRequest as any)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Driver Dashboard POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

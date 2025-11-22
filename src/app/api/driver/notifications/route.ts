import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  getPayoutNotifications,
  getEarningsNotifications,
  getMagazineNotifications,
  getProfileAlerts,
  getNotificationHistory,
  markNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationCenter
} from '@/endpoints/driverNotificationEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'notification-center'

    console.log('GET /api/driver/notifications - Action:', action)

    switch (action) {
      case 'payout-notifications':
        return getPayoutNotifications(req as any)
      
      case 'earnings-notifications':
        return getEarningsNotifications(req as any)
      
      case 'magazine-notifications':
        return getMagazineNotifications(req as any)
      
      case 'profile-alerts':
        return getProfileAlerts(req as any)
      
      case 'notification-history':
        return getNotificationHistory(req as any)
      
      case 'notification-preferences':
        return getNotificationPreferences(req as any)
      
      case 'notification-center':
        return getNotificationCenter(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: [
            'payout-notifications',
            'earnings-notifications', 
            'magazine-notifications',
            'profile-alerts',
            'notification-history',
            'notification-preferences',
            'notification-center'
          ]
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET driver notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const clonedReq = req.clone()
    const body = await clonedReq.json()
    const { action } = body

    console.log('POST /api/driver/notifications - Action:', action)

    switch (action) {
      case 'mark-as-read':
        return markNotificationsAsRead(req as any)
      
      case 'update-preferences':
        return updateNotificationPreferences(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['mark-as-read', 'update-preferences']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST driver notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

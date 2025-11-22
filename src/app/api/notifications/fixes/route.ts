import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  fixPayoutNotifications,
  fixCampaignNotifications,
  sendInvoicePaymentReminders
} from '@/endpoints/notificationDeliveryFixes'

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const clonedReq = req.clone()
    const body = await clonedReq.json()
    const { action } = body

    console.log('POST /api/notifications/fixes - Action:', action)

    switch (action) {
      case 'fix-payout-notifications':
        return fixPayoutNotifications(req as any)
      
      case 'fix-campaign-notifications':
        return fixCampaignNotifications(req as any)
      
      case 'send-payment-reminders':
        return sendInvoicePaymentReminders(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['fix-payout-notifications', 'fix-campaign-notifications', 'send-payment-reminders']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST notification fixes error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

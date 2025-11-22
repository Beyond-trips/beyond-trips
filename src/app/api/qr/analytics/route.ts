import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getQRScanHistory, getQRScanAnalytics } from '@/endpoints/qrScanAnalyticsEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'history'

    console.log('GET /api/qr/analytics - Action:', action)

    switch (action) {
      case 'history':
        return getQRScanHistory(req as any)
      
      case 'analytics':
        return getQRScanAnalytics(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['history', 'analytics']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET QR analytics error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

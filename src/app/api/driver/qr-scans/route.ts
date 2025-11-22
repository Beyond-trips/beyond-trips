import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getDriverScanHistory, getDriverScanStatistics } from '@/endpoints/driverQRHistoryEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'history'

    console.log('GET /api/driver/qr-scans - Action:', action)

    switch (action) {
      case 'history':
        return getDriverScanHistory(req as any)
      
      case 'stats':
        return getDriverScanStatistics(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['history', 'stats']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET driver QR scans error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

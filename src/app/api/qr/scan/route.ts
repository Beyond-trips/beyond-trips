import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { scanMagazineQR, scanAdvertiserQR } from '@/endpoints/qrScanningEndpoints'

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const clonedReq = req.clone()
    const body = await clonedReq.json()
    const { type } = body

    console.log('POST /api/qr/scan - Type:', type)

    // Create payload request object with payload instance
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      json: async () => body,
      body: body,
    } as any

    switch (type) {
      case 'magazine':
        return scanMagazineQR(payloadRequest)
      
      case 'advertiser':
        return scanAdvertiserQR(payloadRequest)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid scan type',
          validTypes: ['magazine', 'advertiser']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST QR scan error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

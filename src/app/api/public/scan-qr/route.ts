import { getPayload } from 'payload'
import config from '@payload-config'
import { scanAdvertiserQR } from '@/endpoints/advertiserQREndpoints'

/**
 * Public QR Code Scanning Endpoint
 * POST /api/public/scan-qr
 * No authentication required
 */
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    
    // Create PayloadRequest-like object
    const req = {
      payload,
      body: request.body,
      url: request.url,
      headers: request.headers,
    } as any

    return await scanAdvertiserQR(req)
  } catch (error: any) {
    console.error('Public QR Scan Route Error:', error)
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS method for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

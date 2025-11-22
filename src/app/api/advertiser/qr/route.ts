import { getPayload } from 'payload'
import config from '@payload-config'
import { generateCampaignQR, getQRAnalytics } from '@/endpoints/advertiserQREndpoints'

/**
 * Advertiser QR Management Route
 * Handles QR generation and analytics for advertisers
 */

/**
 * POST - Generate QR code for campaign
 * GET - Get QR analytics
 */
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    
    // Authenticate user
    const user = await payload.auth({ headers: request.headers })
    
    if (!user || !user.user) {
      return Response.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Only allow partners/advertisers and admins
    const userRole = (user.user.role as any)
    if (userRole !== 'partner' && userRole !== 'admin') {
      return Response.json(
        { error: 'Forbidden - Only advertisers can manage QR codes' },
        { status: 403 }
      )
    }

    // Create PayloadRequest-like object
    const req = {
      payload,
      body: request.body,
      url: request.url,
      headers: request.headers,
      user: user.user,
    } as any

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'generate':
        return await generateCampaignQR(req)
      
      default:
        return Response.json(
          { error: 'Invalid action. Use ?action=generate' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Advertiser QR Route Error:', error)
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get QR analytics
 */
export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config })
    
    // Authenticate user
    const user = await payload.auth({ headers: request.headers })
    
    if (!user || !user.user) {
      return Response.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Create PayloadRequest-like object
    const req = {
      payload,
      url: request.url,
      headers: request.headers,
      user: user.user,
    } as any

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'analytics':
        return await getQRAnalytics(req)
      
      default:
        return Response.json(
          { error: 'Invalid action. Use ?action=analytics' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Advertiser QR GET Route Error:', error)
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

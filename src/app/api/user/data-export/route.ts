import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { exportUserData } from '@/endpoints/userDataEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    
    console.log('GET /api/user/data-export')

    return exportUserData(req as any)
  } catch (error) {
    console.error('❌ GET data export error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

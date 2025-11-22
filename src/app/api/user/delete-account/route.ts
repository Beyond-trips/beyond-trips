import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { requestAccountDeletion, cancelAccountDeletion } from '@/endpoints/userDataEndpoints'

export const POST = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const clonedReq = req.clone()
    const body = await clonedReq.json()
    const { action } = body

    console.log('POST /api/user/delete-account - Action:', action)

    switch (action) {
      case 'request-deletion':
        return requestAccountDeletion(req as any)
      
      case 'cancel-deletion':
        return cancelAccountDeletion(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['request-deletion', 'cancel-deletion']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ POST delete account error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

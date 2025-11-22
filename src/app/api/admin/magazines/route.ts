import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAllMagazinePickups,
  approveMagazinePickup,
  rejectMagazinePickup,
  markMagazinePickedUp,
  getMagazineDistributionStats,
  getMagazineTrackingHistory,
  updatePickupStatus,
  getAllMagazineEditions,
  createMagazineEdition,
  updateMagazineEdition,
  deleteMagazineEdition,
  verifyMagazineReturnByBarcode,
  verifyMagazineReturnManually,
  markMagazineAsPrinted
} from '../../../../endpoints/adminMagazineEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    console.log('📚 Admin Magazine GET request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated:', user.email)
      } else {
        console.log('❌ No authenticated user found')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Admin auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payload request
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
    } as any

    switch (action) {
      case 'pickups':
      case 'list':
        return await getAllMagazinePickups(payloadRequest)
      
      case 'stats':
      case 'distribution-stats':
        return await getMagazineDistributionStats(payloadRequest)
      
      case 'tracking':
      case 'tracking-history':
        return await getMagazineTrackingHistory(payloadRequest)
      
      case 'editions':
      case 'all-editions':
        return await getAllMagazineEditions(payloadRequest)
      
      default:
        // Default to list
        return await getAllMagazinePickups(payloadRequest)
    }
  } catch (error) {
    console.error('❌ Admin Magazine GET error:', error)
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

    console.log('📚 Admin Magazine POST request:', action)

    // Use Payload's built-in authentication
    let user = null
    try {
      const authResult = await payload.auth({
        headers: req.headers
      })
      
      if (authResult.user) {
        user = authResult.user
        console.log('✅ Admin authenticated:', user.email)
      } else {
        console.log('❌ No authenticated user found')
        return new Response(JSON.stringify({
          error: 'Unauthorized - Please log in'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.error('❌ Admin auth error:', error)
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await req.json()

    // Create payload request
    const payloadRequest = {
      payload,
      headers: req.headers,
      url: req.url,
      method: req.method,
      user,
      body,
    } as any

    switch (action) {
      case 'approve':
      case 'approve-pickup':
        return await approveMagazinePickup(payloadRequest)
      
      case 'reject':
      case 'reject-pickup':
        return await rejectMagazinePickup(payloadRequest)
      
      case 'mark-picked-up':
        return await markMagazinePickedUp(payloadRequest)
      
      case 'update-status':
        return await updatePickupStatus(payloadRequest)
      
      case 'create-edition':
        return await createMagazineEdition(payloadRequest)
      
      case 'update-edition':
        return await updateMagazineEdition(payloadRequest)
      
      case 'delete-edition':
        return await deleteMagazineEdition(payloadRequest)
      
      case 'verify-return-barcode':
      case 'verify-return':
        return await verifyMagazineReturnByBarcode(payloadRequest)
      
      case 'verify-return-manual':
      case 'verify-return-manually':
        return await verifyMagazineReturnManually(payloadRequest)
      
      case 'mark-printed':
      case 'mark-as-printed':
        return await markMagazineAsPrinted(payloadRequest)
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Admin Magazine POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


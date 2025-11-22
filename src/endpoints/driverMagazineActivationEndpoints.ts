// endpoints/driverMagazineActivationEndpoints.ts
// Driver magazine activation workflow (different from earning scans)

import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// ===== MAGAZINE ACTIVATION =====

/**
 * Activate magazine for driver
 * POST /api/driver/dashboard?action=activate-magazine
 * Body: { barcode: string, pickupId?: string }
 * 
 * This is DIFFERENT from earning scans (QR codes on ads in magazines)
 * This activates the magazine to the driver's account after pickup
 */
export const activateMagazine = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if user is a driver (drivers have role 'user' in the system)
    if (user.role !== 'user' && user.role !== 'driver') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Driver access only'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { barcode, pickupId } = body

    if (!barcode) {
      return new Response(JSON.stringify({
        error: 'Barcode is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📖 Driver activating magazine:', user.id, 'barcode:', barcode)

    // Find the magazine edition by barcode
    const magazineResults = await req.payload.find({
      collection: 'driver-magazines',
      where: {
        barcode: { equals: barcode }
      },
      limit: 1
    })

    if (magazineResults.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid barcode',
        message: 'Magazine not found with this barcode'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const magazine = magazineResults.docs[0]

    // Check if magazine is active
    if (magazine.status !== 'active') {
      return new Response(JSON.stringify({
        error: 'Magazine not active',
        message: 'This magazine edition is no longer active'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if driver already has this magazine activated
    const existingPickup = await req.payload.find({
      collection: 'magazine-pickups',
      where: {
        and: [
          { driver: { equals: user.id } },
          { magazine: { equals: magazine.id } },
          { status: { not_equals: 'returned' } }
        ]
      },
      limit: 1
    })

    if (existingPickup.docs.length > 0 && existingPickup.docs[0].activatedAt) {
      return new Response(JSON.stringify({
        error: 'Already activated',
        message: 'You have already activated this magazine edition',
        pickup: existingPickup.docs[0]
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create or update pickup record
    let pickupRecord
    if (existingPickup.docs.length > 0) {
      // Update existing pickup with activation
      pickupRecord = await req.payload.update({
        collection: 'magazine-pickups',
        id: existingPickup.docs[0].id,
        data: {
          activatedAt: new Date().toISOString(),
          activationBarcode: barcode,
          status: 'active'
        }
      })
    } else if (pickupId) {
      // Update specific pickup record
      pickupRecord = await req.payload.update({
        collection: 'magazine-pickups',
        id: pickupId,
        data: {
          activatedAt: new Date().toISOString(),
          activationBarcode: barcode,
          status: 'active'
        }
      })
    } else {
      // Create new pickup record (in case driver got magazine outside normal flow)
      pickupRecord = await req.payload.create({
        collection: 'magazine-pickups',
        data: {
          driver: user.id,
          magazine: magazine.id,
          quantity: 1,
          location: {
            name: 'Self-Service Activation',
            address: 'Driver activated via barcode scan'
          },
          pickupDate: new Date().toISOString(),
          activatedAt: new Date().toISOString(),
          activationBarcode: barcode,
          status: 'active',
          quantity: 1
        }
      })
    }

    console.log('✅ Magazine activated successfully for driver:', user.id)

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine activated successfully',
      pickup: pickupRecord,
      magazine: {
        id: magazine.id,
        title: magazine.title,
        editionNumber: magazine.editionNumber,
        issueDate: magazine.issueDate
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error activating magazine:', error)
    return new Response(JSON.stringify({
      error: 'Failed to activate magazine',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get driver's activated magazines
 * GET /api/driver/dashboard?action=my-magazines
 */
export const getDriverMagazines = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (user.role !== 'driver') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Driver access only'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get all pickups for this driver
    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: { driver: { equals: user.id } },
      limit: 100,
      sort: '-activatedAt'
    })

    // Get magazine details for each pickup
    const magazinesWithDetails = await Promise.all(
      pickups.docs.map(async (pickup: any) => {
        const magazineId = typeof pickup.magazineId === 'object' ? pickup.magazineId.id : pickup.magazineId
        
        const magazine = await req.payload.findByID({
          collection: 'driver-magazines',
          id: magazineId
        })

        return {
          pickup: {
            id: pickup.id,
            status: pickup.status,
            activatedAt: pickup.activatedAt,
            activationBarcode: pickup.activationBarcode || null,
            pickupDate: pickup.pickupDate,
            quantity: pickup.quantity
          },
          magazine: {
            id: (magazine as any).id,
            title: (magazine as any).title,
            description: (magazine as any).description,
            imageUrl: (magazine as any).imageUrl,
            barcode: (magazine as any).barcode || null,
            qrImageUrl: (magazine as any).qrImageUrl || null, // S3 URL (preferred)
            barcodeImage: (magazine as any).barcodeImage || null, // Base64 (fallback)
            editionNumber: (magazine as any).editionNumber,
            publishedAt: (magazine as any).publishedAt,
            category: (magazine as any).category,
            readTime: (magazine as any).readTime
          }
        }
      })
    )

    return new Response(JSON.stringify({
      success: true,
      magazines: magazinesWithDetails,
      total: pickups.totalDocs
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error getting driver magazines:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazines',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


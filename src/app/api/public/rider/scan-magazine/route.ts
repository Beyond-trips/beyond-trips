import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

/**
 * Public Magazine Barcode Scanning Endpoint (R1)
 * POST /api/public/rider/scan-magazine
 * No authentication required - riders can scan without logging in
 * 
 * Purpose: Rider scans driver's magazine barcode to access review form
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    
    const { barcode, deviceFingerprint } = body

    // Validation
    if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
      return Response.json(
        {
          error: 'Barcode is required',
        },
        { status: 400 }
      )
    }

    console.log('📱 Rider scanning magazine barcode:', barcode)

    // Find magazine by barcode
    const magazines = await payload.find({
      collection: 'driver-magazines',
      where: {
        barcode: { equals: barcode },
      },
      limit: 1,
    })

    if (magazines.docs.length === 0) {
      return Response.json(
        {
          error: 'Invalid barcode',
          message: 'Magazine not found with this barcode',
        },
        { status: 404 }
      )
    }

    const magazine = magazines.docs[0] as any

    // Check if magazine is published/active
    if (!magazine.isPublished) {
      return Response.json(
        {
          error: 'Magazine not active',
          message: 'This magazine edition is not currently active',
        },
        { status: 400 }
      )
    }

    // Find which driver has this magazine activated
    const pickups = await payload.find({
      collection: 'magazine-pickups',
      where: {
        and: [
          { magazine: { equals: magazine.id } },
          { activationBarcode: { equals: barcode } },
          { status: { in: ['active', 'picked-up'] } },
        ],
      },
      limit: 1,
    })

    if (pickups.docs.length === 0) {
      return Response.json(
        {
          error: 'Magazine not activated',
          message: 'This magazine has not been activated by a driver yet',
        },
        { status: 400 }
      )
    }

    const pickup = pickups.docs[0] as any
    const driverId = typeof pickup.driver === 'object' ? pickup.driver.id : pickup.driver

    // Get driver details
    const driver = await payload.findByID({
      collection: 'users',
      id: driverId,
    })

    if (!driver || (driver as any).role !== 'driver') {
      return Response.json(
        {
          error: 'Driver not found',
          message: 'Associated driver is invalid or not active',
        },
        { status: 404 }
      )
    }

    // Check if this device has already scanned this magazine recently (prevent spam)
    if (deviceFingerprint) {
      const recentScans = await payload.find({
        collection: 'driver-ratings',
        where: {
          and: [
            { driver: { equals: driverId } },
            { magazineBarcode: { equals: barcode } },
            { deviceFingerprint: { equals: deviceFingerprint } },
            {
              createdAt: {
                greater_than: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Last 5 minutes
              },
            },
          ],
        },
        limit: 1,
      })

      if (recentScans.docs.length > 0) {
        return Response.json(
          {
            error: 'Recent scan detected',
            message: 'You have already scanned this magazine recently. Please wait a few minutes before scanning again.',
          },
          { status: 429 }
        )
      }
    }

    console.log('✅ Magazine scan successful - Driver:', driverId)

    // Return driver info for review form
    return Response.json(
      {
        success: true,
        scan: {
          magazineId: magazine.id,
          magazineTitle: magazine.title,
          magazineBarcode: barcode,
          driver: {
            id: driverId,
            firstName: (driver as any).firstName || '',
            lastName: (driver as any).lastName || '',
            name: `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim(),
          },
        },
        message: 'Magazine scanned successfully. Please submit your review.',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ Magazine scan error:', error)
    return Response.json(
      {
        error: 'Failed to scan magazine',
        details: error.message,
      },
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



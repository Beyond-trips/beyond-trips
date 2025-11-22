import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { awardBTLCoin } from '@/endpoints/riderBTLCoinEndpoints'

/**
 * Public Review Submission Endpoint (R2-R3)
 * POST /api/public/rider/submit-review
 * No authentication required - riders can submit reviews without logging in
 * 
 * Purpose: Rider submits review after scanning magazine, triggers BTL coin award
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()

    const {
      barcode,
      rating,
      review,
      raterName,
      raterEmail,
      raterPhone,
      deviceFingerprint,
    } = body

    // Validation
    if (!barcode || typeof barcode !== 'string') {
      return Response.json({ error: 'Barcode is required' }, { status: 400 })
    }

    if (!rating || rating < 1 || rating > 5) {
      return Response.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (!raterName || typeof raterName !== 'string' || raterName.trim().length === 0) {
      return Response.json({ error: 'Rater name is required' }, { status: 400 })
    }

    console.log('⭐ Rider submitting review for barcode:', barcode)

    // Find magazine and driver (same logic as scan-magazine)
    const magazines = await payload.find({
      collection: 'driver-magazines',
      where: { barcode: { equals: barcode } },
      limit: 1,
    })

    if (magazines.docs.length === 0) {
      return Response.json(
        { error: 'Invalid barcode', message: 'Magazine not found' },
        { status: 404 }
      )
    }

    const magazine = magazines.docs[0] as any

    // Find driver who has this magazine
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
        { error: 'Magazine not activated', message: 'Cannot submit review for inactive magazine' },
        { status: 400 }
      )
    }

    const pickup = pickups.docs[0] as any
    const driverId = typeof pickup.driver === 'object' ? pickup.driver.id : pickup.driver

    // Verify driver exists and is active
    const driver = await payload.findByID({
      collection: 'users',
      id: driverId,
    })

    // Note: Drivers have role 'user' in the system, not 'driver'
    if (!driver || ((driver as any).role !== 'user' && (driver as any).role !== 'driver')) {
      return Response.json(
        { error: 'Driver not found' },
        { status: 404 }
      )
    }

    // Check for duplicate reviews from same device
    if (deviceFingerprint) {
      const existingByDevice = await payload.find({
        collection: 'driver-ratings',
        where: {
          and: [
            { driver: { equals: driverId } },
            { magazineBarcode: { equals: barcode } },
            { deviceFingerprint: { equals: deviceFingerprint } },
          ],
        },
        limit: 1,
      })

      if (existingByDevice.docs.length > 0) {
        return Response.json(
          {
            error: 'Duplicate review',
            message: 'You have already submitted a review for this driver from this device',
          },
          { status: 409 }
        )
      }
    }

    // Check for duplicate reviews from same email
    if (raterEmail) {
      const existingByEmail = await payload.find({
        collection: 'driver-ratings',
        where: {
          and: [
            { driver: { equals: driverId } },
            { magazineBarcode: { equals: barcode } },
            { raterEmail: { equals: raterEmail } },
          ],
        },
        limit: 1,
      })

      if (existingByEmail.docs.length > 0) {
        return Response.json(
          {
            error: 'Duplicate review',
            message: 'You have already submitted a review for this driver with this email',
          },
          { status: 409 }
        )
      }
    }

    // Create rating record
    const ratingRecord = await payload.create({
      collection: 'driver-ratings',
      data: {
        driver: driverId,
        rating,
        review: review || '',
        raterName,
        raterEmail: raterEmail || null,
        raterPhone: raterPhone || null,
        deviceFingerprint: deviceFingerprint || null,
        magazineBarcode: barcode,
        scanTimestamp: new Date().toISOString(),
        category: 'overall',
        isVerified: false,
        isPublic: true,
        isModerated: false,
        btlCoinAwarded: false, // Will be updated after BTL coin award
      },
    })

    console.log('✅ Rating created:', ratingRecord.id)

    // Award BTL coin to driver (R4-R5)
    const btlCoinResult = await awardBTLCoin(
      { payload } as any,
      {
        driverId,
        magazineId: magazine.id,
        magazineBarcode: barcode,
        reviewId: ratingRecord.id,
        riderDeviceId: deviceFingerprint,
        riderName: raterName,
      }
    )

    // Update rating record with BTL coin status
    if (btlCoinResult.success) {
      await payload.update({
        collection: 'driver-ratings',
        id: ratingRecord.id,
        data: {
          btlCoinAwarded: true,
        },
      })
      console.log('✅ BTL coin awarded successfully')
    } else {
      console.error('⚠️ BTL coin award failed:', btlCoinResult.error)
      // Don't fail the review submission if BTL coin award fails
    }

    // Return success confirmation (R3)
    return Response.json(
      {
        success: true,
        message: 'Thank you for your feedback! Your input has been recorded successfully.',
        rating: {
          id: ratingRecord.id,
          rating,
          btlCoinAwarded: btlCoinResult.success,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ Submit review error:', error)
    return Response.json(
      {
        error: 'Failed to submit review',
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



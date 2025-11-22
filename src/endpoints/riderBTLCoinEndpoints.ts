// endpoints/riderBTLCoinEndpoints.ts
// BTL Coin award logic for rider interactions

import type { PayloadRequest } from 'payload'

interface BTLCoinAwardInput {
  driverId: string
  magazineId: string
  magazineBarcode: string
  reviewId: string
  riderDeviceId?: string
  riderName?: string
}

/**
 * Award BTL Coin to driver after valid rider review
 * Internal function called by submit-review endpoint
 */
export const awardBTLCoin = async (
  req: PayloadRequest,
  input: BTLCoinAwardInput
): Promise<{ success: boolean; btlCoinId?: string; earningId?: string; error?: string }> => {
  try {
    const { driverId, magazineId, magazineBarcode, reviewId, riderDeviceId, riderName } = input

    console.log('🪙 Awarding BTL coin to driver:', driverId, 'for review:', reviewId)

    // Check if BTL coin already awarded for this review
    const existingAward = await req.payload.find({
      collection: 'btl-coin-awards',
      where: {
        review: { equals: reviewId },
      },
      limit: 1,
    })

    if (existingAward.docs.length > 0) {
      console.log('⚠️ BTL coin already awarded for this review')
      return {
        success: false,
        error: 'BTL coin already awarded for this review',
      }
    }

    // Create BTL coin award record
    const btlCoinAward = await req.payload.create({
      collection: 'btl-coin-awards',
      data: {
        driver: driverId,
        magazine: magazineId,
        magazineBarcode,
        review: reviewId,
        riderDeviceId: riderDeviceId || null,
        riderName: riderName || null,
        amount: 1,
        status: 'awarded',
        awardedAt: new Date().toISOString(),
      },
    })

    console.log('✅ BTL coin award created:', btlCoinAward.id)

    // Create driver earnings record for BTL coin
    // BTL coins are worth 500 Naira (same as regular scans)
    const earning = await req.payload.create({
      collection: 'driver-earnings',
      data: {
        driver: driverId,
        scans: 0, // BTL coins don't count as scans
        points: 1, // 1 BTL coin = 1 point
        amount: 500, // 500 Naira per BTL coin
        currency: 'NGN',
        type: 'bonus',
        source: 'btl_coin',
        status: 'active',
        description: 'BTL Coin reward from rider interaction',
      },
    })

    console.log('✅ Driver earnings created for BTL coin:', earning.id)

    // Update BTL coin award with earning record
    await req.payload.update({
      collection: 'btl-coin-awards',
      id: btlCoinAward.id,
      data: {
        earningRecord: earning.id,
        status: 'processed',
      },
    })

    // Update magazine pickup record with BTL coin count
    try {
      const magazinePickups = await req.payload.find({
        collection: 'magazine-pickups',
        where: {
          and: [
            { driver: { equals: driverId } },
            { magazine: { equals: magazineId } },
          ],
        },
        limit: 1,
      })

      if (magazinePickups.docs.length > 0) {
        const pickup = magazinePickups.docs[0] as any
        await req.payload.update({
          collection: 'magazine-pickups',
          id: pickup.id,
          data: {
            btlCoinsEarned: (pickup.btlCoinsEarned || 0) + 1,
            riderScans: (pickup.riderScans || 0) + 1,
          },
        })
      }
    } catch (error) {
      console.error('⚠️ Failed to update magazine pickup stats:', error)
      // Don't fail the BTL coin award if pickup update fails
    }

    // Send notification to driver
    try {
      await req.payload.create({
        collection: 'driver-notifications',
        data: {
          driver: driverId,
          type: 'earnings',
          title: 'BTL Coin Earned! 🪙',
          message: "You've earned 1 BTL coin from a passenger interaction. Thank you for providing excellent service!",
          isRead: false,
          priority: 'medium',
        },
      })
    } catch (error) {
      console.error('⚠️ Failed to send driver notification:', error)
      // Don't fail the BTL coin award if notification fails
    }

    // Create admin log entry
    try {
      await req.payload.create({
        collection: 'admin-notifications',
        data: {
          type: 'system',
          title: 'BTL Coin Awarded',
          message: `BTL_COIN_AWARD: Driver ${driverId} earned 1 BTL coin from rider review ${reviewId}`,
          isRead: false,
          priority: 'low',
          metadata: JSON.stringify({
            event: 'BTL_COIN_AWARD',
            driverId,
            magazineId,
            magazineBarcode,
            reviewId,
            timestamp: new Date().toISOString(),
          }),
        },
      })
    } catch (error) {
      console.error('⚠️ Failed to create admin log entry:', error)
      // Don't fail the BTL coin award if admin log fails
    }

    return {
      success: true,
      btlCoinId: btlCoinAward.id,
      earningId: earning.id,
    }
  } catch (error) {
    console.error('❌ Error awarding BTL coin:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to award BTL coin',
    }
  }
}

/**
 * Get BTL coin awards for a driver
 * For driver dashboard
 */
export const getDriverBTLCoins = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req

    if (!user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('🪙 Getting BTL coins for driver:', user.id)

    const awards = await req.payload.find({
      collection: 'btl-coin-awards',
      where: {
        driver: { equals: user.id },
      },
      sort: '-awardedAt',
      page,
      limit,
    })

    const totalCoins = awards.docs.length
    const totalEarnings = totalCoins * 500 // 500 Naira per coin

    return new Response(
      JSON.stringify({
        success: true,
        btlCoins: {
          total: totalCoins,
          totalEarnings,
          awards: awards.docs.map((award: any) => ({
            id: award.id,
            amount: award.amount,
            awardedAt: award.awardedAt,
            riderName: award.riderName,
            status: award.status,
          })),
        },
        pagination: {
          page: awards.page,
          totalPages: awards.totalPages,
          totalDocs: awards.totalDocs,
          hasNextPage: awards.hasNextPage,
          hasPrevPage: awards.hasPrevPage,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Get BTL coins error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to get BTL coins',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}



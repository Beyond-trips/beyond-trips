import type { PayloadRequest } from 'payload'
import QRCode from 'qrcode'
import { qrCodeStorage } from '../config/cloudStorage'

/**
 * Helper function to parse request body
 */
async function parseRequestBody(req: PayloadRequest): Promise<any> {
  if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
    return req.body
  }

  if (req.body instanceof ReadableStream) {
    const reader = req.body.getReader()
    const chunks: Uint8Array[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }

    const bodyText = new TextDecoder().decode(
      new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[]))
    )

    return JSON.parse(bodyText)
  }

  return {}
}

/**
 * Generate unique QR code identifier
 */
function generateQRCodeId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ADV-QR-${timestamp}-${random}`
}

/**
 * Generate redemption code
 */
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Generate QR Code for Campaign
 * POST /api/advertiser/qr?action=generate
 */
export async function generateCampaignQR(req: PayloadRequest): Promise<Response> {
  try {
    const body = await parseRequestBody(req)
    const { 
      campaignId, 
      promoTitle, 
      promoDescription, 
      promoLink, 
      promoTerms,
      expiresAt,
      maxScans 
    } = body

    // Validate required fields
    if (!campaignId || !promoTitle || !promoLink) {
      return Response.json(
        { error: 'Missing required fields: campaignId, promoTitle, promoLink' },
        { status: 400 }
      )
    }

    // Verify campaign exists
    const campaign = await req.payload.findByID({
      collection: 'ad-campaigns',
      id: campaignId,
    })

    if (!campaign) {
      return Response.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Generate unique QR code
    const qrCodeId = generateQRCodeId()
    
    // Generate QR code image buffer
    const qrBuffer = await QRCode.toBuffer(qrCodeId, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 500,
      margin: 2,
    })
    
    // Upload QR code to S3
    const uploadResult = await qrCodeStorage.uploadFile(
      qrBuffer,
      `qr-${qrCodeId}.png`,
      'image/png',
      'advertiser-qr-codes'
    )
    
    console.log(`✅ Advertiser QR code uploaded to S3: ${uploadResult.url}`)
    
    // Generate base64 for backward compatibility
    const qrImageData = `data:image/png;base64,${qrBuffer.toString('base64')}`

    // Create QR code record
    const qrCode = await req.payload.create({
      collection: 'advertiser-qr-codes',
      data: {
        campaign: campaignId,
        qrCode: qrCodeId,
        qrImageUrl: uploadResult.url, // S3 URL (primary)
        qrImageData, // Base64 (backward compatibility)
        promoTitle,
        promoDescription,
        promoLink,
        promoTerms,
        expiresAt,
        maxScans,
        status: 'active',
        scansCount: 0,
        uniqueScansCount: 0,
        redemptionsCount: 0,
      } as any,
    })

    // Update campaign with QR code reference
    await req.payload.update({
      collection: 'ad-campaigns',
      id: campaignId,
      data: {
        qrCode: qrCode.id,
      },
    })

    return Response.json({
      success: true,
      message: 'QR code generated successfully',
      qrCode: {
        id: qrCode.id,
        qrCodeId,
        qrImageUrl: (qrCode as any).qrImageUrl, // S3 URL (preferred)
        qrImageData, // Base64 (fallback)
        promoTitle,
        promoLink,
        status: 'active',
      },
    })
  } catch (error: any) {
    console.error('Generate QR Error:', error)
    return Response.json(
      { error: 'Failed to generate QR code', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Scan Advertiser QR Code (Public Endpoint - No Auth Required)
 * POST /api/public/scan-advertiser-qr
 */
export async function scanAdvertiserQR(req: PayloadRequest): Promise<Response> {
  try {
    const body = await parseRequestBody(req)
    const { qrCode, deviceId, ipAddress, userAgent, magazineBarcode, driverId } = body

    console.log('📱 QR Scan Request:', { qrCode, deviceId })

    // ✅ Checkpoint 1: Validate input
    if (!qrCode || typeof qrCode !== 'string' || qrCode.trim() === '') {
      return Response.json(
        { error: 'Invalid QR code - must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!deviceId || typeof deviceId !== 'string') {
      return Response.json(
        { error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // ✅ Checkpoint 2: Look up QR code
    const qrCodeRecords = await req.payload.find({
      collection: 'advertiser-qr-codes',
      where: {
        qrCode: {
          equals: qrCode.trim(),
        },
      },
      limit: 1,
    })

    if (!qrCodeRecords.docs || qrCodeRecords.docs.length === 0) {
      return Response.json(
        { error: 'QR code not found - invalid or expired' },
        { status: 404 }
      )
    }

    const qrCodeRecord = qrCodeRecords.docs[0]

    // ✅ Checkpoint 3: Verify QR code is active
    if (qrCodeRecord.status !== 'active') {
      // Create failed engagement record
      await req.payload.create({
        collection: 'qr-engagements',
        data: {
          qrCode: qrCodeRecord.id,
          deviceId,
          scannedAt: new Date(),
          ipAddress,
          userAgent,
          status: 'failed',
          reason: `QR code is ${qrCodeRecord.status}`,
        },
      })

      return Response.json(
        { 
          error: `This campaign is no longer active (${qrCodeRecord.status})`,
          status: qrCodeRecord.status,
        },
        { status: 400 }
      )
    }

    // ✅ Checkpoint 4: Check if expired
    if (qrCodeRecord.expiresAt && new Date(qrCodeRecord.expiresAt) < new Date()) {
      // Update QR code status to expired
      await req.payload.update({
        collection: 'advertiser-qr-codes',
        id: qrCodeRecord.id,
        data: { status: 'expired' },
      })

      return Response.json(
        { error: 'This offer has expired' },
        { status: 400 }
      )
    }

    // ✅ Checkpoint 5: Check max scans limit
    if (qrCodeRecord.maxScans && qrCodeRecord.scansCount >= qrCodeRecord.maxScans) {
      await req.payload.update({
        collection: 'advertiser-qr-codes',
        id: qrCodeRecord.id,
        data: { status: 'inactive' },
      })

      return Response.json(
        { error: 'This offer has reached its maximum redemption limit' },
        { status: 400 }
      )
    }

    // ✅ Checkpoint 6: Check for duplicate scan (same deviceId)
    const existingScans = await req.payload.find({
      collection: 'qr-engagements',
      where: {
        and: [
          {
            qrCode: {
              equals: qrCodeRecord.id,
            },
          },
          {
            deviceId: {
              equals: deviceId,
            },
          },
          {
            status: {
              in: ['scanned', 'redeemed'],
            },
          },
        ],
      },
      limit: 1,
    })

    if (existingScans.docs && existingScans.docs.length > 0) {
      // Create duplicate engagement record
      await req.payload.create({
        collection: 'qr-engagements',
        data: {
          qrCode: qrCodeRecord.id,
          deviceId,
          scannedAt: new Date(),
          ipAddress,
          userAgent,
          status: 'duplicate',
          reason: 'Device has already scanned this QR code',
        },
      })

      console.log('❌ Duplicate scan detected:', deviceId)

      return Response.json(
        {
          success: false,
          error: "You've already claimed this offer",
          status: 'duplicate',
          reason: 'This device has already scanned this QR code',
        },
        { status: 409 }
      )
    }

    // ✅ Checkpoint 7: Generate redemption code
    const redemptionCode = generateRedemptionCode()

    // ✅ Checkpoint 8: Create engagement record
    const engagement = await req.payload.create({
      collection: 'qr-engagements',
      data: {
        qrCode: qrCodeRecord.id,
        deviceId,
        scannedAt: new Date(),
        ipAddress,
        userAgent,
        redemptionCode,
        status: 'redeemed', // Auto-redeem on scan
        redeemedAt: new Date(),
        magazineBarcode: magazineBarcode || null, // Track if scanned from magazine
        driver: driverId || null, // Track which driver's magazine was scanned
      },
    })

    // ✅ Checkpoint 9: Update QR code metrics
    const isUniqueDevice = existingScans.totalDocs === 0
    await req.payload.update({
      collection: 'advertiser-qr-codes',
      id: qrCodeRecord.id,
      data: {
        scansCount: (qrCodeRecord.scansCount || 0) + 1,
        uniqueScansCount: isUniqueDevice 
          ? (qrCodeRecord.uniqueScansCount || 0) + 1 
          : qrCodeRecord.uniqueScansCount,
        redemptionsCount: (qrCodeRecord.redemptionsCount || 0) + 1,
      },
    })

    console.log('✅ QR scan successful:', {
      qrCode,
      deviceId,
      redemptionCode,
    })

    // ✅ Checkpoint 10: Return redemption details
    return Response.json({
      success: true,
      message: 'Offer claimed successfully!',
      offer: {
        title: qrCodeRecord.promoTitle,
        description: qrCodeRecord.promoDescription,
        redemptionCode,
        promoLink: qrCodeRecord.promoLink,
        terms: qrCodeRecord.promoTerms,
        expiresAt: qrCodeRecord.expiresAt,
      },
      engagement: {
        id: engagement.id,
        scannedAt: engagement.scannedAt,
        status: 'redeemed',
      },
    })
  } catch (error: any) {
    console.error('❌ QR Scan Error:', error)
    return Response.json(
      { error: 'Failed to process QR code scan', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Get QR Code Analytics for Campaign
 * GET /api/advertiser/qr?action=analytics&campaignId=xxx
 */
export async function getQRAnalytics(req: PayloadRequest): Promise<Response> {
  try {
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')

    if (!campaignId) {
      return Response.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Get QR code for campaign
    const qrCodes = await req.payload.find({
      collection: 'advertiser-qr-codes',
      where: {
        campaign: {
          equals: campaignId,
        },
      },
      limit: 1,
    })

    if (!qrCodes.docs || qrCodes.docs.length === 0) {
      return Response.json({
        success: true,
        analytics: {
          totalScans: 0,
          uniqueDevices: 0,
          redemptions: 0,
          conversionRate: 0,
          status: 'no_qr_code',
        },
      })
    }

    const qrCode = qrCodes.docs[0]

    // Get all engagements
    const engagements = await req.payload.find({
      collection: 'qr-engagements',
      where: {
        qrCode: {
          equals: qrCode.id,
        },
      },
      limit: 1000,
    })

    // Calculate metrics
    const totalScans = qrCode.scansCount || 0
    const uniqueDevices = qrCode.uniqueScansCount || 0
    const redemptions = qrCode.redemptionsCount || 0
    const conversionRate = totalScans > 0 
      ? ((redemptions / totalScans) * 100).toFixed(2) 
      : 0

    // Group by status
    const statusBreakdown = engagements.docs.reduce((acc: any, eng: any) => {
      acc[eng.status] = (acc[eng.status] || 0) + 1
      return acc
    }, {})

    // Get recent scans (last 10)
    const recentScans = engagements.docs
      .sort((a: any, b: any) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
      .slice(0, 10)
      .map((eng: any) => ({
        deviceId: eng.deviceId.substring(0, 12) + '...', // Truncate for privacy
        scannedAt: eng.scannedAt,
        status: eng.status,
        location: eng.location?.city || 'Unknown',
      }))

    return Response.json({
      success: true,
      analytics: {
        totalScans,
        uniqueDevices,
        redemptions,
        conversionRate: parseFloat(conversionRate as string),
        status: qrCode.status,
        qrCode: qrCode.qrCode,
        createdAt: qrCode.createdAt,
        expiresAt: qrCode.expiresAt,
        maxScans: qrCode.maxScans,
        statusBreakdown,
        recentScans,
      },
    })
  } catch (error: any) {
    console.error('Get QR Analytics Error:', error)
    return Response.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    )
  }
}

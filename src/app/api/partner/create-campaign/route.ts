import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { businessId, campaignType, campaignName, campaignDescription } = body

    const businessDetails = await payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails || !(businessDetails as any).emailVerified) {
      return NextResponse.json(
        { error: 'Email must be verified first' },
        { status: 400 }
      )
    }

    // Create ad campaign
    const adCampaign = await payload.create({
      collection: 'ad-campaigns',
      data: {
        businessId,
        campaignType,
        campaignName: campaignName || `Campaign for ${(businessDetails as any).companyName}`,
        campaignDescription: campaignDescription || '',
        status: 'draft',
        // Required fields will be set later when campaign is activated
      } as any, // Use type assertion to allow draft campaigns without budget/dates
    })

    // Update business registration status
    await payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'campaign_setup',
      },
    })

    return NextResponse.json({
      success: true,
      campaignId: adCampaign.id,
      message: 'Ad campaign created successfully',
      nextStep: 'payment_setup',
    })
  } catch (error) {
    console.error('Ad campaign creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create ad campaign' },
      { status: 500 }
    )
  }
}

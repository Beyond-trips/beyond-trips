import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getPayload({ config })
    const businessId = params.id

    const businessDetails = await payload.findByID({
      collection: 'business-details',
      id: businessId,
      depth: 2,
    })

    if (!businessDetails) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Get related data
    const adCampaigns = await payload.find({
      collection: 'ad-campaigns',
      where: {
        businessId: {
          equals: businessId,
        },
      },
    })

    const paymentBudgeting = await payload.find({
      collection: 'payment-budgeting',
      where: {
        businessId: {
          equals: businessId,
        },
      },
      limit: 1,
    })

    return NextResponse.json({
      success: true,
      businessDetails,
      adCampaigns: adCampaigns.docs,
      paymentPlan: paymentBudgeting.docs[0] || null,
    })
  } catch (error) {
    console.error('Get status error:', error)
    return NextResponse.json(
      { error: 'Failed to get registration status' },
      { status: 500 }
    )
  }
}

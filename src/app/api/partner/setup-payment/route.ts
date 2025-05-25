import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { businessId, pricingTier, monthlyBudget, paymentMethod } = body

    const businessDetails = await payload.findByID({
      collection: 'business-details',
      id: businessId,
    })

    if (!businessDetails) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Create payment budgeting record
    const paymentBudgeting = await payload.create({
      collection: 'payment-budgeting',
      data: {
        businessId,
        pricingTier,
        monthlyBudget,
        paymentMethod,
        paymentStatus: 'pending',
        subscriptionStartDate: new Date().toISOString(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })

    // Update business registration status
    await payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'payment_setup',
      },
    })

    return NextResponse.json({
      success: true,
      paymentId: paymentBudgeting.id,
      message: 'Payment plan selected',
      nextStep: 'submission_confirmation',
    })
  } catch (error) {
    console.error('Payment setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup payment plan' },
      { status: 500 }
    )
  }
}

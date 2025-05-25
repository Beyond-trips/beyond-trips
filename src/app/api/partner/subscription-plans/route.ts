import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    const plans = await payload.find({
      collection: 'subscription-plans',
      where: {
        isActive: {
          equals: true,
        },
      },
    })

    return NextResponse.json({
      success: true,
      plans: plans.docs,
    })
  } catch (error) {
    console.error('Get plans error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription plans' },
      { status: 500 }
    )
  }
}

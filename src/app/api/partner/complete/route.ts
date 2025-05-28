import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { businessId } = body

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

    // Update business details to completed
    await payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        registrationStatus: 'completed',
      },
    })

    

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
    })
  } catch (error) {
    console.error('Complete registration error:', error)
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}

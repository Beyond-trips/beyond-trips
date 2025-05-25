#!/bin/bash

echo "Creating API route structure..."

mkdir -p src/app/api/partner/register
mkdir -p src/app/api/partner/verify-email
mkdir -p src/app/api/partner/resend-code
mkdir -p src/app/api/partner/create-campaign
mkdir -p src/app/api/partner/subscription-plans
mkdir -p src/app/api/partner/setup-payment
mkdir -p src/app/api/partner/complete
mkdir -p src/app/api/partner/status/\[id\]
mkdir -p src/app/api/user/generate-otp
mkdir -p src/app/api/user/verify-otp
mkdir -p src/app/api/user/resend-otp

echo "✅ Directories created!"

cat > src/app/api/partner/register/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    
    const { 
      companyEmail, 
      password, 
      confirmPassword, 
      companyName, 
      companyAddress, 
      contact, 
      industry 
    } = body

    // Validate password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    // Check if business already exists
    const existingBusiness = await payload.find({
      collection: 'business-details',
      where: {
        companyEmail: {
          equals: companyEmail,
        },
      },
      limit: 1,
    })

    if (existingBusiness.docs.length > 0) {
      return NextResponse.json(
        { error: 'Business email already registered' },
        { status: 400 }
      )
    }

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString()

    // Create business details
    const businessDetails = await payload.create({
      collection: 'business-details',
      data: {
        companyEmail,
        password, // In production, this should be hashed
        companyName,
        companyAddress,
        contact,
        industry,
        emailVerified: false,
        verificationCode,
        registrationStatus: 'pending',
        registrationDate: new Date().toISOString(),
      },
    })

    // TODO: Send verification email here
    console.log(`🔐 Verification code for ${companyEmail}: ${verificationCode}`)

    return NextResponse.json({
      success: true,
      businessId: businessDetails.id,
      message: 'Registration started. Please check your email for verification code.',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed', details: error },
      { status: 500 }
    )
  }
}
EOF

cat > src/app/api/partner/verify-email/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { businessId, verificationCode } = body

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

    // Check if code is valid
    if ((businessDetails as any).verificationCode !== verificationCode) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Update business details
    await payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        emailVerified: true,
        verificationCode: null,
        registrationStatus: 'email_verified',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      nextStep: 'ad_campaign_setup',
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
EOF

cat > src/app/api/partner/create-campaign/route.ts << 'EOF'
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
        campaignDescription,
        status: 'draft',
      },
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
EOF

cat > src/app/api/partner/subscription-plans/route.ts << 'EOF'
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
EOF

cat > src/app/api/partner/setup-payment/route.ts << 'EOF'
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
EOF

cat > src/app/api/partner/complete/route.ts << 'EOF'
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

    // Create a user account for the business
    const user = await payload.create({
      collection: 'users',
      data: {
        email: (businessDetails as any).companyEmail,
        password: (businessDetails as any).password,
        username: (businessDetails as any).companyName,
        role: 'user',
        emailVerified: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
      userId: user.id,
    })
  } catch (error) {
    console.error('Complete registration error:', error)
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}
EOF

cat > src/app/api/partner/status/\[id\]/route.ts << 'EOF'
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
EOF

echo "✅ All route files created!"
echo ""
echo "Now restart your development server and run the test script again."
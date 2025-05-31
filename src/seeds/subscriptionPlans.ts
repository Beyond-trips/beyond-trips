// seeds/subscriptionPlans.ts

import { getPayload } from 'payload'
import config from '../payload.config'

export const seedSubscriptionPlans = async (payload?: any) => {
  try {
    console.log('🌱 Seeding subscription plans...')
    
    // Use provided payload or get a new instance
    const payloadInstance = payload || await getPayload({ config })

    // Check if plans already exist to avoid duplicates
    const existingPlans = await payloadInstance.find({
      collection: 'subscription-plans',
      limit: 1,
    })

    if (existingPlans.docs.length > 0) {
      console.log('📋 Subscription plans already exist, skipping seed...')
      return
    }

    // Define the subscription plans
    const plans = [
      {
        planName: 'Starter',
        planType: 'starter',
        price: 0,
        currency: 'NGN',
        billingCycle: 'monthly',
        description: 'For the new advertiser on a budget who just wants basic tracking...',
        features: [
          { feature: 'Basic Analytics Dashboard' },
          { feature: 'Email Support' },
          { feature: 'Up to 1,000 monthly impressions' },
          { feature: 'Basic Campaign Management' },
          { feature: 'Standard Reporting' },
        ],
        isActive: true,
      },
      {
        planName: 'Standard',
        planType: 'standard',
        price: 0, // Currently showing N0.00/month in your UI
        currency: 'NGN',
        billingCycle: 'monthly',
        description: 'For growing businesses who need more advanced features...',
        features: [
          { feature: 'Advanced Analytics Dashboard' },
          { feature: 'Priority Email Support' },
          { feature: 'Up to 10,000 monthly impressions' },
          { feature: 'Multi-Campaign Management' },
          { feature: 'Advanced Reporting & Insights' },
          { feature: 'A/B Testing Tools' },
          { feature: 'Custom Audience Targeting' },
        ],
        isActive: true,
      },
      {
        planName: 'Pro',
        planType: 'pro',
        price: 0, // Currently showing N0.00/month in your UI
        currency: 'NGN',
        billingCycle: 'monthly',
        description: 'For enterprises who need comprehensive advertising solutions...',
        features: [
          { feature: 'Enterprise Analytics Dashboard' },
          { feature: '24/7 Phone & Email Support' },
          { feature: 'Unlimited monthly impressions' },
          { feature: 'Enterprise Campaign Management' },
          { feature: 'Real-time Analytics & Reporting' },
          { feature: 'Advanced A/B Testing Suite' },
          { feature: 'Custom Audience & Lookalike Audiences' },
          { feature: 'White-label Options' },
          { feature: 'API Access' },
          { feature: 'Dedicated Account Manager' },
        ],
        isActive: true,
      },
    ]

    // Create each plan
    for (const planData of plans) {
      try {
        const createdPlan = await payloadInstance.create({
          collection: 'subscription-plans',
          data: planData,
        })
        console.log(`✅ Created plan: ${createdPlan.planName}`)
      } catch (error) {
        console.error(`❌ Error creating plan ${planData.planName}:`, error)
      }
    }

    console.log('🎉 Subscription plans seeded successfully!')
    
    // If we created our own payload instance, we don't need to close it
    // as getPayload handles this automatically
    
  } catch (error) {
    console.error('❌ Error seeding subscription plans:', error)
    throw error
  }
}

// Function to run seed independently
export const runSeed = async () => {
  try {
    console.log('🚀 Starting subscription plans seed...')
    await seedSubscriptionPlans()
    console.log('✅ Seed completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }
}

runSeed()

export default seedSubscriptionPlans
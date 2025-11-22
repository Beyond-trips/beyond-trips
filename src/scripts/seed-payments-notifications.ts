import { getPayload } from 'payload'
import config from '@/payload.config'

async function seedPaymentsAndNotifications() {
  const payload = await getPayload({ config })

  console.log('🌱 Seeding Payments & Notifications Test Data...')

  try {
    // Create test advertisers if they don't exist
    console.log('📝 Creating test advertisers...')

    const advertiserUsers = [
      {
        email: 'advertiser1@test.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Advertiser One',
        userType: 'advertiser',
        verified: true
      },
      {
        email: 'advertiser2@test.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Advertiser Two',
        userType: 'advertiser',
        verified: true
      }
    ]

    const advertiserIds: string[] = []

    for (const advertiser of advertiserUsers) {
      try {
        // Check if user exists
        const existingUsers = await payload.find({
          collection: 'users-users',
          where: { email: { equals: advertiser.email } },
          limit: 1
        })

        let userId: string

        if (existingUsers.docs.length > 0) {
          userId = existingUsers.docs[0].id
          console.log(`✅ Advertiser ${advertiser.email} already exists`)
        } else {
          // Create new user
          const user = await payload.create({
            collection: 'users-users',
            data: advertiser as any
          })
          userId = user.id
          console.log(`✅ Created advertiser: ${advertiser.email}`)
        }

        advertiserIds.push(userId)

        // Create or update business details
        try {
          const businesses = await payload.find({
            collection: 'business-details',
            where: { companyEmail: { equals: advertiser.email } },
            limit: 1
          })

          if (businesses.docs.length === 0) {
            await payload.create({
              collection: 'business-details',
              data: {
                companyName: `${advertiser.firstName}'s Company`,
                companyEmail: advertiser.email,
                contactName: `${advertiser.firstName} ${advertiser.lastName}`,
                phone: '+2348012345678',
                address: 'Lagos, Nigeria',
                city: 'Lagos',
                country: 'Nigeria',
                businessRegistration: 'REG12345',
                status: 'verified'
              }
            })
            console.log(`✅ Created business profile for ${advertiser.email}`)
          }
        } catch (error) {
          console.log(`Note: Business profile already exists or error occurred`)
        }
      } catch (error) {
        console.error(`Error with advertiser ${advertiser.email}:`, String(error))
      }
    }

    // Create test invoices
    console.log('📝 Creating test invoices...')

    const testInvoices = [
      {
        invoiceNumber: `INV-${Date.now()}-001`,
        businessId: advertiserIds[0],
        amount: 50000,
        currency: 'NGN',
        description: 'Campaign 1 - Lagos Advertising',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            description: 'Logo Placement Campaign',
            quantity: 1,
            unitPrice: 50000
          }
        ]
      },
      {
        invoiceNumber: `INV-${Date.now()}-002`,
        businessId: advertiserIds[1],
        amount: 75000,
        currency: 'NGN',
        description: 'Campaign 2 - Digital Ads',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            description: 'Digital Display Ads',
            quantity: 3,
            unitPrice: 25000
          }
        ]
      }
    ]

    for (const invoice of testInvoices) {
      try {
        const existingInvoices = await payload.find({
          collection: 'invoices',
          where: { invoiceNumber: { equals: invoice.invoiceNumber } },
          limit: 1
        })

        if (existingInvoices.docs.length === 0) {
          await payload.create({
            collection: 'invoices',
            data: invoice as any
          })
          console.log(`✅ Created invoice: ${invoice.invoiceNumber}`)
        } else {
          console.log(`✅ Invoice ${invoice.invoiceNumber} already exists`)
        }
      } catch (error) {
        console.error(`Error creating invoice:`, String(error))
      }
    }

    // Create notification templates
    console.log('📝 Creating notification templates...')

    const templates = [
      {
        templateId: 'payment_confirmation',
        type: 'email',
        name: 'Payment Confirmation',
        subject: 'Payment Confirmation - Beyond Trips',
        content: `<h2>Payment Received</h2><p>Dear {name},</p><p>We have received your payment of ₦{amount} for invoice {invoiceNumber}.</p><p>Thank you for your business!</p>`
      },
      {
        templateId: 'payment_failed',
        type: 'email',
        name: 'Payment Failed',
        subject: 'Payment Failed - Action Required',
        content: `<h2>Payment Failed</h2><p>Dear {name},</p><p>Unfortunately, your payment of ₦{amount} failed.</p><p>Please try again or contact support.</p>`
      },
      {
        templateId: 'payout_approved',
        type: 'email',
        name: 'Payout Approved',
        subject: 'Your Payout Has Been Approved',
        content: `<h2>Payout Approved</h2><p>Dear {driverName},</p><p>Your payout request of ₦{amount} has been approved.</p><p>You will receive the funds within 2-3 business days.</p>`
      },
      {
        templateId: 'campaign_approved',
        type: 'email',
        name: 'Campaign Approved',
        subject: 'Your Campaign Has Been Approved',
        content: `<h2>Campaign Approved</h2><p>Dear {advertiserName},</p><p>Your campaign "{campaignName}" has been approved and is ready to go live.</p>`
      }
    ]

    for (const template of templates) {
      try {
        const existingTemplates = await payload.find({
          collection: 'notification-templates',
          where: { templateId: { equals: template.templateId } },
          limit: 1
        })

        if (existingTemplates.docs.length === 0) {
          await payload.create({
            collection: 'notification-templates',
            data: template as any
          })
          console.log(`✅ Created template: ${template.templateId}`)
        } else {
          console.log(`✅ Template ${template.templateId} already exists`)
        }
      } catch (error) {
        console.error(`Error creating template:`, String(error))
      }
    }

    // Create test payment records
    console.log('📝 Creating test payment records...')

    const testPayments = [
      {
        invoiceNumber: `PAYMENT-${Date.now()}-001`,
        amount: 25000,
        currency: 'NGN',
        status: 'completed',
        paymentMethod: 'stripe',
        paymentDate: new Date().toISOString(),
        stripePaymentIntentId: 'pi_test_001'
      },
      {
        invoiceNumber: `PAYMENT-${Date.now()}-002`,
        amount: 50000,
        currency: 'NGN',
        status: 'completed',
        paymentMethod: 'stripe',
        paymentDate: new Date().toISOString(),
        stripePaymentIntentId: 'pi_test_002'
      }
    ]

    for (const payment of testPayments) {
      try {
        const existing = await payload.find({
          collection: 'invoices',
          where: { invoiceNumber: { equals: payment.invoiceNumber } },
          limit: 1
        })

        if (existing.docs.length === 0) {
          await payload.create({
            collection: 'invoices',
            data: payment as any
          })
          console.log(`✅ Created payment record: ${payment.invoiceNumber}`)
        }
      } catch (error) {
        console.error(`Error creating payment:`, String(error))
      }
    }

    console.log('✅ Payments & Notifications seeding complete!')
  } catch (error) {
    console.error('❌ Seeding error:', error)
    process.exit(1)
  }
}

seedPaymentsAndNotifications()

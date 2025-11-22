import { PayloadRequest } from 'payload'
import Stripe from 'stripe'
import { stripe, stripeWebhookSecret, testCards } from '../config/stripe'

// ===== STRIPE PAYMENT ENDPOINTS =====

/**
 * Create a payment intent for advertiser invoices
 * POST /api/payments/stripe/create-intent
 */
export const createPaymentIntent = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { amount, currency = 'NGN', invoiceId, email, metadata = {} } = body

    if (!amount || amount < 100) {
      return new Response(JSON.stringify({ 
        error: 'Invalid amount - minimum ₦100 required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Creating payment intent for ₦${amount}`)

    // Create Stripe customer if needed
    let customer: Stripe.Customer
    
    try {
      const customers = await stripe.customers.list({
        email: email || user.email,
        limit: 1
      })
      
      if (customers.data.length > 0) {
        customer = customers.data[0]
      } else {
        customer = await stripe.customers.create({
          email: email || user.email,
          metadata: {
            userId: user.id,
            userType: user.userType || 'advertiser'
          }
        })
      }
    } catch (error) {
      console.error('Error creating/retrieving customer:', error)
      throw error
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects cents
      currency: currency.toLowerCase(),
      customer: customer.id,
      description: `Invoice ${invoiceId} - Beyond Trips`,
      metadata: {
        invoiceId,
        userId: user.id,
        ...metadata
      },
      // For Nigerian transactions
      payment_method_types: ['card'],
      receipt_email: email || user.email
    })

    console.log(`✅ Payment intent created: ${paymentIntent.id}`)

    return new Response(JSON.stringify({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Create payment intent error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to create payment intent',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Process webhook from Stripe
 * POST /api/payments/stripe/webhook
 */
export const handleStripeWebhook = async (req: PayloadRequest): Promise<Response> => {
  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()

    if (!signature || !stripeWebhookSecret) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let event: Stripe.Event
    
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📨 Webhook event received: ${event.type}`)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`✅ Payment succeeded: ${paymentIntent.id}`)
        
        // Update invoice status in database
        if (paymentIntent.metadata?.invoiceId) {
          try {
            await req.payload.update({
              collection: 'invoices',
              id: paymentIntent.metadata.invoiceId,
              data: {
                status: 'paid',
                paymentMethod: 'stripe',
                stripePaymentIntentId: paymentIntent.id,
                paidAt: new Date().toISOString()
              }
            })
            console.log(`💾 Invoice ${paymentIntent.metadata.invoiceId} marked as paid`)
          } catch (error) {
            console.error('Error updating invoice:', error)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`❌ Payment failed: ${paymentIntent.id}`)
        
        // Update invoice status
        if (paymentIntent.metadata?.invoiceId) {
          try {
            await req.payload.update({
              collection: 'invoices',
              id: paymentIntent.metadata.invoiceId,
              data: {
                status: 'payment_failed',
                failureReason: paymentIntent.last_payment_error?.message
              }
            })
          } catch (error) {
            console.error('Error updating invoice:', error)
          }
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        console.log(`🔄 Refund processed: ${charge.id}`)
        
        // Create refund record
        if (charge.metadata?.invoiceId) {
          try {
            await req.payload.create({
              collection: 'invoices',
              data: {
                invoiceNumber: `REFUND-${charge.id}`,
                amount: -Math.abs(charge.amount / 100),
                status: 'refunded',
                paymentMethod: 'stripe',
                relatedChargeId: charge.id,
                createdAt: new Date().toISOString()
              }
            })
          } catch (error) {
            console.error('Error creating refund record:', error)
          }
        }
        break
      }

      default:
        console.log(`⚠️ Unhandled webhook type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Webhook handler error:', error)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get payment status
 * GET /api/payments/stripe/status/:paymentIntentId
 */
export const getPaymentStatus = async (req: PayloadRequest, paymentIntentId: string): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: new Date(paymentIntent.created * 1000).toISOString(),
        lastError: paymentIntent.last_payment_error?.message
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get payment status error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get payment status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Process refund
 * POST /api/payments/stripe/refund
 */
export const processRefund = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    if (!user || user.userType !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = body

    if (!paymentIntentId) {
      return new Response(JSON.stringify({ error: 'Payment intent ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🔄 Processing refund for ${paymentIntentId}`)

    // Get the charge associated with the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (!paymentIntent.charges.data.length) {
      return new Response(JSON.stringify({ error: 'No charge found for this payment' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const charge = paymentIntent.charges.data[0]

    // Create refund
    const refund = await stripe.refunds.create({
      charge: charge.id,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as Stripe.RefundCreateParams.Reason,
      metadata: {
        refundedBy: user.id,
        originalPaymentIntentId: paymentIntentId
      }
    })

    console.log(`✅ Refund created: ${refund.id}`)

    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        created: new Date(refund.created * 1000).toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Process refund error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to process refund',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get payment history
 * GET /api/payments/stripe/history
 */
export const getPaymentHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get customers for this user
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 10
    })

    const allPayments: any[] = []

    // Get payment intents for all customer IDs
    for (const customer of customers.data) {
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 50
      })

      allPayments.push(...paymentIntents.data)
    }

    // Sort by creation date (newest first)
    allPayments.sort((a, b) => b.created - a.created)

    return new Response(JSON.stringify({
      success: true,
      payments: allPayments.map(pi => ({
        id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency,
        status: pi.status,
        created: new Date(pi.created * 1000).toISOString(),
        description: pi.description,
        invoiceId: pi.metadata?.invoiceId
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get payment history error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get payment history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Test payment (for development)
 * POST /api/payments/stripe/test
 */
export const testPayment = async (req: PayloadRequest): Promise<Response> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return new Response(JSON.stringify({ error: 'Test payments not available in production' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { user } = req
    const body = await req.json()
    const { amount = 50000, cardType = 'visa', email = 'test@example.com' } = body

    console.log(`🧪 Creating test payment: ₦${amount}`)

    // Create test payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'ngn',
      description: 'Test payment - Beyond Trips',
      metadata: {
        test: 'true',
        userId: user?.id || 'test-user'
      },
      receipt_email: email,
      payment_method_types: ['card']
    })

    return new Response(JSON.stringify({
      success: true,
      testPayment: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amount,
        testCard: testCards[cardType as keyof typeof testCards] || testCards.visa,
        instructions: 'Use this test card to complete the payment'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Test payment error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create test payment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export default {
  createPaymentIntent,
  handleStripeWebhook,
  getPaymentStatus,
  processRefund,
  getPaymentHistory,
  testPayment
}

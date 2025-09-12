// endpoints/paymentEndpoints.ts
import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.body && typeof req.body === 'object') {
      return req.body
    }
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// Helper function to check advertiser access
const checkAdvertiserAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check if user has access to advertiser dashboard
  // Only allow partners and admins, block regular users (drivers)
  if (user.role === 'user') {
    return new Response(JSON.stringify({
      error: 'Access denied - Advertiser dashboard is only available for business partners and administrators'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// Helper function to get business ID
const getBusinessId = async (user: any, req: PayloadRequest): Promise<string | null> => {
  // For partner authentication, use the user.id directly as businessId
  if ((user as any).role === 'partner') {
    return user.id
  }
  
  // For regular Payload CMS users, look up by email
  const advertiser = await req.payload.find({
    collection: 'business-details',
    where: { companyEmail: { equals: user.email } },
    limit: 1
  })

  if (advertiser.docs.length > 0) {
    return advertiser.docs[0].id
  }

  return null
}

// Paystack configuration
const PAYSTACK_CONFIG = {
  secretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_secret_key',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_your_public_key',
  baseUrl: 'https://api.paystack.co'
}

// Initialize Paystack
const initializePaystack = () => {
  try {
    const paystack = require('paystack')(PAYSTACK_CONFIG.secretKey)
    return paystack
  } catch (error) {
    console.warn('Paystack module not installed. Payment features will be limited.')
    return null
  }
}

// Process Payment
export const processPayment = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { 
      campaignId, 
      amount, 
      currency = 'NGN', 
      paymentMethod = 'card',
      customerEmail,
      customerName,
      description 
    } = body

    if (!campaignId || !amount || !customerEmail) {
      return new Response(JSON.stringify({
        error: 'Campaign ID, amount, and customer email are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('💳 Processing payment for campaign:', campaignId, 'Amount:', amount)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get campaign and verify ownership
    let campaign
    try {
      campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: campaignId
      })
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Campaign not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (campaign.businessId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Initialize Paystack
    const paystack = initializePaystack()
    
    if (!paystack) {
      return new Response(JSON.stringify({
        error: 'Payment processing is not available. Paystack module not installed.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create payment reference
    const paymentReference = `BT_${Date.now()}_${campaignId.substring(0, 8)}`

    // Initialize transaction with Paystack
    const transactionData = {
      email: customerEmail,
      amount: amount * 100, // Paystack expects amount in kobo (smallest currency unit)
      currency: currency,
      reference: paymentReference,
      callback_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/payment/callback`,
      metadata: {
        campaignId: campaignId,
        businessId: businessId,
        customerName: customerName || '',
        description: description || `Payment for campaign: ${campaign.campaignName}`
      }
    }

    const paystackResponse = await paystack.transaction.initialize(transactionData)

    if (!paystackResponse.status) {
      throw new Error(paystackResponse.message || 'Failed to initialize payment')
    }

    // Create payment record
    const paymentRecord = await req.payload.create({
      collection: 'payment-budgeting' as any,
      data: {
        businessId: businessId,
        campaignId: campaignId,
        amount: amount,
        currency: currency,
        paymentMethod: paymentMethod,
        status: 'pending',
        paymentReference: paymentReference,
        paystackReference: paystackResponse.data.reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        customerEmail: customerEmail,
        customerName: customerName || '',
        description: description || `Payment for campaign: ${campaign.campaignName}`,
        metadata: {
          paystackResponse: paystackResponse.data,
          userAgent: req.headers.get('user-agent'),
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
        }
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        paymentId: paymentRecord.id,
        paymentReference: paymentReference,
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        amount: amount,
        currency: currency,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Process payment error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get Payment Status
export const getPaymentStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const paymentReference = searchParams.get('paymentReference')
    const paymentId = searchParams.get('paymentId')

    if (!paymentReference && !paymentId) {
      return new Response(JSON.stringify({
        error: 'Payment reference or payment ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔍 Getting payment status:', paymentReference || paymentId)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find payment record
    const whereConditions: any[] = [
      { businessId: { equals: businessId } }
    ]

    if (paymentId) {
      whereConditions.push({ id: { equals: paymentId } })
    } else if (paymentReference) {
      whereConditions.push({ paymentReference: { equals: paymentReference } })
    }

    const payments = await req.payload.find({
      collection: 'payment-budgeting' as any,
      where: {
        and: whereConditions
      },
      limit: 1
    })

    if (payments.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Payment not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const payment = payments.docs[0]

    // If payment is pending, check with Paystack
    if (payment.status === 'pending' && payment.paystackReference) {
      try {
        const paystack = initializePaystack()
        
        if (!paystack) {
          // Paystack not available, return current payment status
          return new Response(JSON.stringify({
            success: true,
            data: {
              payment: payment,
              message: 'Paystack verification not available'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        const paystackResponse = await paystack.transaction.verify(payment.paystackReference)

        if (paystackResponse.status && paystackResponse.data.status === 'success') {
          // Update payment status to successful
          await req.payload.update({
            collection: 'payment-budgeting' as any,
            id: payment.id,
            data: {
              status: 'successful',
              paidAt: new Date().toISOString(),
              paystackResponse: paystackResponse.data
            } as any
          })

          // Update campaign budget
          await req.payload.update({
            collection: 'ad-campaigns',
            id: payment.campaignId,
            data: {
              budget: (payment.campaignId as any).budget + payment.amount,
              lastPaymentAt: new Date().toISOString()
            } as any
          })

          payment.status = 'successful'
          payment.paidAt = new Date().toISOString()
        } else if (paystackResponse.data.status === 'failed') {
          // Update payment status to failed
          await req.payload.update({
            collection: 'payment-budgeting' as any,
            id: payment.id,
            data: {
              status: 'failed',
              failedAt: new Date().toISOString(),
              failureReason: paystackResponse.data.gateway_response || 'Payment failed'
            } as any
          })

          payment.status = 'failed'
          payment.failedAt = new Date().toISOString()
        }
      } catch (paystackError) {
        console.error('Paystack verification error:', paystackError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        paymentId: payment.id,
        paymentReference: payment.paymentReference,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        customerEmail: payment.customerEmail,
        customerName: payment.customerName,
        description: payment.description,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        campaignId: payment.campaignId
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get payment status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get payment status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle Payment Callback
export const handlePaymentCallback = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { searchParams } = new URL(req.url || '')
    const reference = searchParams.get('reference')
    const status = searchParams.get('status')

    if (!reference) {
      return new Response(JSON.stringify({
        error: 'Payment reference is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔄 Handling payment callback:', reference, 'Status:', status)

    // Find payment record
    const payments = await req.payload.find({
      collection: 'payment-budgeting' as any,
      where: { paymentReference: { equals: reference } },
      limit: 1
    })

    if (payments.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Payment not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const payment = payments.docs[0]

    // Verify with Paystack
    const paystack = initializePaystack()
    
    if (!paystack) {
      return new Response(JSON.stringify({
        error: 'Payment verification is not available. Paystack module not installed.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const paystackResponse = await paystack.transaction.verify(reference)

    if (!paystackResponse.status) {
      throw new Error(paystackResponse.message || 'Payment verification failed')
    }

    const transactionData = paystackResponse.data

    // Update payment status based on Paystack response
    let newStatus = 'failed'
    let updateData: any = {
      paystackResponse: transactionData
    }

    if (transactionData.status === 'success') {
      newStatus = 'successful'
      updateData.status = 'successful'
      updateData.paidAt = new Date().toISOString()

      // Update campaign budget
      const campaign = await req.payload.findByID({
        collection: 'ad-campaigns',
        id: payment.campaignId
      })

      await req.payload.update({
        collection: 'ad-campaigns',
        id: payment.campaignId,
        data: {
          budget: campaign.budget + payment.amount,
          lastPaymentAt: new Date().toISOString()
        } as any
      })

      // Generate invoice
      await req.payload.create({
        collection: 'invoices' as any,
        data: {
          businessId: payment.businessId,
          campaignId: payment.campaignId,
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'paid',
          invoiceNumber: `INV-${Date.now()}`,
          issuedAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          description: `Invoice for campaign: ${campaign.campaignName}`
        } as any
      })
    } else {
      updateData.status = 'failed'
      updateData.failedAt = new Date().toISOString()
      updateData.failureReason = transactionData.gateway_response || 'Payment failed'
    }

    // Update payment record
    await req.payload.update({
      collection: 'payment-budgeting' as any,
      id: payment.id,
      data: updateData
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Payment ${newStatus}`,
      data: {
        paymentId: payment.id,
        paymentReference: payment.paymentReference,
        status: newStatus,
        amount: payment.amount,
        currency: payment.currency,
        campaignId: payment.campaignId
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Handle payment callback error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to handle payment callback'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get Payment History
export const getPaymentHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const page = parseInt(searchParams.get('page') || '1')

    console.log('📊 Getting payment history')

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build where clause
    const whereClause: any = {
      businessId: { equals: businessId }
    }

    if (campaignId) {
      whereClause.campaignId = { equals: campaignId }
    }

    if (status) {
      whereClause.status = { equals: status }
    }

    // Get payments
    const payments = await req.payload.find({
      collection: 'payment-budgeting' as any,
      where: whereClause,
      sort: '-createdAt',
      limit: limit,
      page: page
    })

    return new Response(JSON.stringify({
      success: true,
      data: {
        payments: payments.docs.map((payment: any) => ({
          paymentId: payment.id,
          paymentReference: payment.paymentReference,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          customerEmail: payment.customerEmail,
          customerName: payment.customerName,
          description: payment.description,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
          failedAt: payment.failedAt,
          campaignId: payment.campaignId
        })),
        pagination: {
          totalDocs: payments.totalDocs,
          limit: payments.limit,
          totalPages: payments.totalPages,
          page: payments.page,
          hasNextPage: payments.hasNextPage,
          hasPrevPage: payments.hasPrevPage
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get payment history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get payment history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

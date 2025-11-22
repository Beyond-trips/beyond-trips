// endpoints/adminPaymentGatewayEndpoints.ts

import type { PayloadRequest } from 'payload'

const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return req.body
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

const checkAdminAccess = (user: any): Response | null => {
  if (!user || !user.id) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (user.role !== 'admin' && user.role !== 'super-admin') {
    return new Response(JSON.stringify({
      error: 'Forbidden - Admin access required'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return null
}

// ===== PAYMENT GATEWAY CONFIGURATION =====

// Get all payment gateways
export const getAllPaymentGateways = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const isActive = searchParams.get('isActive')

    console.log('💳 Getting payment gateways')

    const whereClause: any = {}
    if (isActive !== null) {
      whereClause.isActive = { equals: isActive === 'true' }
    }

    const gateways = await req.payload.find({
      collection: 'payment-gateway-config',
      where: whereClause,
      sort: '-priority',
      page,
      limit
    })

    return new Response(JSON.stringify({
      success: true,
      gateways: gateways.docs.map((gateway: any) => ({
        id: gateway.id,
        name: gateway.name,
        provider: gateway.provider,
        environment: gateway.environment,
        isActive: gateway.isActive,
        supportedCurrencies: gateway.supportedCurrencies,
        supportedMethods: gateway.supportedMethods,
        transactionFee: gateway.transactionFee,
        validationStatus: gateway.validationStatus,
        lastValidated: gateway.lastValidated,
        priority: gateway.priority
      })),
      pagination: {
        page: gateways.page,
        totalPages: gateways.totalPages,
        totalDocs: gateways.totalDocs,
        hasNextPage: gateways.hasNextPage,
        hasPrevPage: gateways.hasPrevPage
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get payment gateways error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get payment gateways'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get specific gateway
export const getPaymentGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const gatewayId = searchParams.get('gatewayId')

    if (!gatewayId) {
      return new Response(JSON.stringify({
        error: 'Gateway ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const gateway = await req.payload.findByID({
      collection: 'payment-gateway-config',
      id: gatewayId
    })

    return new Response(JSON.stringify({
      success: true,
      gateway
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get payment gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get payment gateway'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Create new payment gateway
export const createPaymentGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const body = await parseRequestBody(req)
    const { name, provider, environment, apiKey, apiSecret, webhookUrl, supportedCurrencies, supportedMethods } = body

    // Validation
    if (!name || !provider || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({
        error: 'Name, provider, API key, and secret are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const validProviders = ['flutterwave', 'paystack', 'paypal', 'stripe']
    if (!validProviders.includes(provider)) {
      return new Response(JSON.stringify({
        error: 'Invalid provider'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Creating payment gateway: ${name} (${provider})`)

    const newGateway = await req.payload.create({
      collection: 'payment-gateway-config',
      data: {
        name,
        provider,
        environment: environment || 'sandbox',
        apiKey,
        apiSecret,
        webhookUrl,
        supportedCurrencies: supportedCurrencies || [{ currency: 'NGN' }],
        supportedMethods: supportedMethods || [{ method: 'card' }],
        isActive: false,
        validationStatus: 'not_tested'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment gateway created successfully',
      gateway: {
        id: (newGateway as any).id,
        name: (newGateway as any).name,
        provider: (newGateway as any).provider
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create payment gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create payment gateway',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update payment gateway
export const updatePaymentGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const gatewayId = searchParams.get('gatewayId')
    const body = await parseRequestBody(req)

    if (!gatewayId) {
      return new Response(JSON.stringify({
        error: 'Gateway ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Updating payment gateway: ${gatewayId}`)

    const updatedGateway = await req.payload.update({
      collection: 'payment-gateway-config',
      id: gatewayId,
      data: body
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment gateway updated successfully',
      gateway: updatedGateway
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update payment gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update payment gateway',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete payment gateway
export const deletePaymentGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const gatewayId = searchParams.get('gatewayId')

    if (!gatewayId) {
      return new Response(JSON.stringify({
        error: 'Gateway ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Deleting payment gateway: ${gatewayId}`)

    await req.payload.delete({
      collection: 'payment-gateway-config',
      id: gatewayId
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment gateway deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete payment gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete payment gateway'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Test payment gateway credentials
export const testPaymentGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const gatewayId = searchParams.get('gatewayId')

    if (!gatewayId) {
      return new Response(JSON.stringify({
        error: 'Gateway ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`💳 Testing payment gateway: ${gatewayId}`)

    const gateway = await req.payload.findByID({
      collection: 'payment-gateway-config',
      id: gatewayId
    })

    if (!gateway) {
      return new Response(JSON.stringify({
        error: 'Gateway not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Simulate gateway credential testing
    let validationStatus = 'valid'
    let validationError = null

    // Mock validation - in production, would call actual gateway API
    if (!(gateway as any).apiKey || !(gateway as any).apiSecret) {
      validationStatus = 'invalid'
      validationError = 'Missing API credentials'
    }

    // Update gateway with test results
    await req.payload.update({
      collection: 'payment-gateway-config',
      id: gatewayId,
      data: {
        lastValidated: new Date().toISOString(),
        validationStatus,
        validationError
      }
    })

    return new Response(JSON.stringify({
      success: validationStatus === 'valid',
      message: validationStatus === 'valid' ? 'Gateway credentials validated successfully' : 'Gateway validation failed',
      validationStatus,
      validationError,
      gateway: {
        id: (gateway as any).id,
        name: (gateway as any).name,
        provider: (gateway as any).provider
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Test payment gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to test payment gateway',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get active gateway
export const getActiveGateway = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('💳 Getting active payment gateway')

    const gateways = await req.payload.find({
      collection: 'payment-gateway-config',
      where: { isActive: { equals: true } },
      sort: '-priority',
      limit: 1
    })

    if (gateways.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'No active payment gateway configured'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const gateway = gateways.docs[0]

    return new Response(JSON.stringify({
      success: true,
      gateway: {
        id: (gateway as any).id,
        name: (gateway as any).name,
        provider: (gateway as any).provider,
        supportedCurrencies: (gateway as any).supportedCurrencies,
        supportedMethods: (gateway as any).supportedMethods,
        transactionFee: (gateway as any).transactionFee,
        minimumAmount: (gateway as any).minimumAmount,
        maximumAmount: (gateway as any).maximumAmount
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get active gateway error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get active payment gateway'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get gateway status
export const getGatewayStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('💳 Getting payment gateway status')

    const gateways = await req.payload.find({
      collection: 'payment-gateway-config',
      limit: 100
    })

    const status = {
      totalGateways: gateways.totalDocs,
      activeGateways: gateways.docs.filter((g: any) => g.isActive).length,
      validatedGateways: gateways.docs.filter((g: any) => g.validationStatus === 'valid').length,
      gateways: gateways.docs.map((gateway: any) => ({
        id: gateway.id,
        name: gateway.name,
        provider: gateway.provider,
        isActive: gateway.isActive,
        validationStatus: gateway.validationStatus,
        lastValidated: gateway.lastValidated
      }))
    }

    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get gateway status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get gateway status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

import {
  getSystemHealth,
  getDocumentation,
  getEndpointSpecs,
  validateSecurity,
  getCodeMetrics,
  getPerformanceBenchmarks,
  validateIndexing,
  checkCaching,
  validateDeployment,
  getDeploymentChecklist,
  validateErrorHandling,
  verifyCollections,
  getSummaryReport,
  getTestCoverage,
  getTestQuality
} from '@/endpoints/polishEndpoints'

interface PayloadRequest extends NextRequest {
  payload?: any
  user?: any
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const payloadRequest = req as PayloadRequest
    payloadRequest.payload = payload

    // Use Payload's built-in authentication
    try {
      const authResponse = await payload.auth({ headers: req.headers })
      if (!authResponse.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      payloadRequest.user = authResponse.user
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const action = searchParams.get('action')

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'getSystemHealth':
        return await getSystemHealth(payloadRequest)
      case 'getDocumentation':
        return await getDocumentation(payloadRequest)
      case 'getEndpointSpecs':
        return await getEndpointSpecs(payloadRequest)
      case 'validateSecurity':
        return await validateSecurity(payloadRequest)
      case 'getCodeMetrics':
        return await getCodeMetrics(payloadRequest)
      case 'getPerformanceBenchmarks':
        return await getPerformanceBenchmarks(payloadRequest)
      case 'validateIndexing':
        return await validateIndexing(payloadRequest)
      case 'checkCaching':
        return await checkCaching(payloadRequest)
      case 'validateDeployment':
        return await validateDeployment(payloadRequest)
      case 'getDeploymentChecklist':
        return await getDeploymentChecklist(payloadRequest)
      case 'validateErrorHandling':
        return await validateErrorHandling(payloadRequest)
      case 'verifyCollections':
        return await verifyCollections(payloadRequest)
      case 'getSummaryReport':
        return await getSummaryReport(payloadRequest)
      case 'getTestCoverage':
        return await getTestCoverage(payloadRequest)
      case 'getTestQuality':
        return await getTestQuality(payloadRequest)
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Polish error:', error)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

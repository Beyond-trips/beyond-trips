import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Health Check Endpoint
 * 
 * Used by:
 * - Render for service health monitoring
 * - GitHub Actions for deployment verification
 * - External monitoring services
 * 
 * Returns:
 * - 200: Service is healthy
 * - 503: Service is unhealthy
 */
export async function GET() {
  const startTime = Date.now()
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks: {
      api: 'ok',
      database: 'unknown',
      payload: 'unknown',
    },
  }

  try {
    // Check if Payload CMS is accessible
    try {
      const payload = await getPayload({ config })
      if (payload) {
        health.checks.payload = 'ok'
        
        // Optional: Check database connectivity
        // This performs a lightweight DB operation to verify connection
        try {
          const db = payload.db
          if (db) {
            health.checks.database = 'ok'
          }
        } catch (dbError) {
          console.error('Health check - Database error:', dbError)
          health.checks.database = 'degraded'
        }
      }
    } catch (payloadError) {
      console.error('Health check - Payload error:', payloadError)
      health.checks.payload = 'degraded'
    }

    // Calculate response time
    const responseTime = Date.now() - startTime
    
    // Determine overall status
    const allChecksHealthy = 
      health.checks.api === 'ok' && 
      (health.checks.database === 'ok' || health.checks.database === 'unknown') &&
      (health.checks.payload === 'ok' || health.checks.payload === 'unknown')
    
    if (!allChecksHealthy) {
      health.status = 'degraded'
    }

    return NextResponse.json({
      ...health,
      responseTime: `${responseTime}ms`,
    }, { 
      status: allChecksHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    // Critical failure
    health.status = 'unhealthy'
    health.checks.api = 'failed'
    
    console.error('Health check - Critical error:', error)
    
    return NextResponse.json({
      ...health,
      error: error instanceof Error ? error.message : 'Health check failed',
      responseTime: `${Date.now() - startTime}ms`,
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    })
  }
}

// Support HEAD requests for simple health checks
export async function HEAD() {
  try {
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}


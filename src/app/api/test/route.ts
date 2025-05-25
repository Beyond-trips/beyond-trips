import { NextRequest, NextResponse } from 'next/server'
import { getPayloadHMR } from '@payloadcms/next/utilities'
import config from '../../../payload.config'

export async function GET(req: NextRequest) {
  try {
    console.log('Testing Payload connection...')
    const payload = await getPayloadHMR({ config })
    
    // Test a simple Payload operation
    const users = await payload.find({
      collection: 'users',
      limit: 1
    })
    
    return NextResponse.json({
      success: true,
      message: 'Payload is working',
      userCount: users.totalDocs,
      payloadReady: true
    })
  } catch (error) {
    console.error('Payload test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payloadReady: false
    }, { status: 500 })
  }
}

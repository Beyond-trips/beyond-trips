import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import {
  getProfileCompleteness,
  getMissingFields,
  getGuidedCompletionSteps,
  getProgressIndicatorData
} from '@/endpoints/profileCompletenessEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'completeness'

    console.log('GET /api/user/profile-completeness - Action:', action)

    switch (action) {
      case 'completeness':
        return getProfileCompleteness(req as any)
      
      case 'missing-fields':
        return getMissingFields(req as any)
      
      case 'guided-completion':
        return getGuidedCompletionSteps(req as any)
      
      case 'progress-indicator':
        return getProgressIndicatorData(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: [
            'completeness',
            'missing-fields',
            'guided-completion',
            'progress-indicator'
          ]
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET profile completeness error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

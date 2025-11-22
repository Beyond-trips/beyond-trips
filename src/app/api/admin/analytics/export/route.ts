import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { exportAnalyticsToCSV, exportAnalyticsToPDF } from '@/endpoints/analyticsExportEndpoints'

export const GET = async (req: NextRequest) => {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'csv'

    console.log('GET /api/admin/analytics/export - Format:', format)

    switch (format) {
      case 'csv':
        return exportAnalyticsToCSV(req as any)
      
      case 'pdf':
        return exportAnalyticsToPDF(req as any)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid format',
          validFormats: ['csv', 'pdf']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ GET analytics export error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

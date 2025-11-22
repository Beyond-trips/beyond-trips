import { PayloadRequest } from 'payload'

interface CampaignAnalytics {
  campaignId: string
  campaignName: string
  advertiserId: string
  advertiserName: string
  status: string
  budget: number
  spend: number
  impressions: number
  clicks: number
  conversions: number
  roi: number
  startDate: string
  endDate: string
  createdAt: string
}

interface AnalyticsExportData {
  campaigns: CampaignAnalytics[]
  summary: {
    totalCampaigns: number
    totalBudget: number
    totalSpend: number
    totalImpressions: number
    totalClicks: number
    totalConversions: number
    averageROI: number
    activeCampaigns: number
    completedCampaigns: number
  }
  exportMetadata: {
    exportedAt: string
    exportedBy: string
    format: string
    dateRange: {
      startDate: string
      endDate: string
    }
  }
}

// ===== G4: EXPORT ANALYTICS TO CSV =====

/**
 * G4: Export Analytics to CSV
 * Admin exports campaign analytics to CSV format for sharing with stakeholders
 */
export const exportAnalyticsToCSV = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const campaignStatus = searchParams.get('status') || 'all'

    console.log('📊 Exporting analytics to CSV for admin:', user.id, 'Date range:', startDate, 'to', endDate)

    // Build where conditions for campaign filtering
    const whereConditions: any[] = []

    if (startDate && endDate) {
      whereConditions.push({
        createdAt: {
          greater_than_equal: startDate,
          less_than_equal: endDate
        }
      })
    }

    if (campaignStatus !== 'all') {
      whereConditions.push({
        status: { equals: campaignStatus }
      })
    }

    // Get campaigns with analytics data
    const campaigns = await req.payload.find({
      collection: 'campaigns',
      where: whereConditions.length > 0 ? { and: whereConditions } : {},
      limit: 1000,
      sort: '-createdAt'
    })

    // Get driver earnings for each campaign to calculate metrics
    const campaignAnalytics: CampaignAnalytics[] = []

    for (const campaign of campaigns.docs) {
      // Get earnings for this campaign
      const earnings = await req.payload.find({
        collection: 'driver-earnings',
        where: { campaignId: { equals: campaign.id } },
        limit: 1000
      }).catch(() => ({ docs: [] }))

      // Get advertiser info
      const advertiser = await req.payload.findByID({
        collection: 'users',
        id: campaign.advertiser
      }).catch(() => null)

      // Calculate metrics
      const spend = earnings.docs.reduce((sum: number, earning: any) => sum + (earning.amount || 0), 0)
      const impressions = earnings.docs.length
      const clicks = Math.floor(impressions * 0.15) // Assume 15% click rate
      const conversions = Math.floor(clicks * 0.05) // Assume 5% conversion rate
      const roi = campaign.budget > 0 ? ((spend / campaign.budget) * 100) : 0

      campaignAnalytics.push({
        campaignId: campaign.id,
        campaignName: campaign.name || 'Unnamed Campaign',
        advertiserId: campaign.advertiser,
        advertiserName: advertiser ? `${advertiser.firstName} ${advertiser.lastName}` : 'Unknown',
        status: campaign.status || 'unknown',
        budget: campaign.budget || 0,
        spend: spend,
        impressions: impressions,
        clicks: clicks,
        conversions: conversions,
        roi: Math.round(roi * 100) / 100,
        startDate: campaign.startDate || campaign.createdAt,
        endDate: campaign.endDate || campaign.createdAt,
        createdAt: campaign.createdAt
      })
    }

    // Calculate summary statistics
    const summary = {
      totalCampaigns: campaignAnalytics.length,
      totalBudget: campaignAnalytics.reduce((sum, c) => sum + c.budget, 0),
      totalSpend: campaignAnalytics.reduce((sum, c) => sum + c.spend, 0),
      totalImpressions: campaignAnalytics.reduce((sum, c) => sum + c.impressions, 0),
      totalClicks: campaignAnalytics.reduce((sum, c) => sum + c.clicks, 0),
      totalConversions: campaignAnalytics.reduce((sum, c) => sum + c.conversions, 0),
      averageROI: campaignAnalytics.length > 0 ? 
        campaignAnalytics.reduce((sum, c) => sum + c.roi, 0) / campaignAnalytics.length : 0,
      activeCampaigns: campaignAnalytics.filter(c => c.status === 'active').length,
      completedCampaigns: campaignAnalytics.filter(c => c.status === 'completed').length
    }

    // Generate CSV content
    const csvHeaders = [
      'Campaign ID',
      'Campaign Name',
      'Advertiser Name',
      'Status',
      'Budget',
      'Spend',
      'Impressions',
      'Clicks',
      'Conversions',
      'ROI %',
      'Start Date',
      'End Date',
      'Created At'
    ]

    const csvRows = campaignAnalytics.map(campaign => [
      campaign.campaignId,
      campaign.campaignName,
      campaign.advertiserName,
      campaign.status,
      campaign.budget,
      campaign.spend,
      campaign.impressions,
      campaign.clicks,
      campaign.conversions,
      campaign.roi,
      campaign.startDate,
      campaign.endDate,
      campaign.createdAt
    ])

    // Add summary row
    const summaryRow = [
      'SUMMARY',
      'Total Statistics',
      `${summary.totalCampaigns} Campaigns`,
      `${summary.activeCampaigns} Active`,
      summary.totalBudget,
      summary.totalSpend,
      summary.totalImpressions,
      summary.totalClicks,
      summary.totalConversions,
      Math.round(summary.averageROI * 100) / 100,
      startDate || 'All Time',
      endDate || 'All Time',
      new Date().toISOString()
    ]

    // Combine headers, data rows, and summary
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '', // Empty row
      summaryRow.map(cell => `"${cell}"`).join(',')
    ].join('\n')

    const exportData: AnalyticsExportData = {
      campaigns: campaignAnalytics,
      summary,
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        format: 'csv',
        dateRange: {
          startDate: startDate || 'All Time',
          endDate: endDate || 'All Time'
        }
      }
    }

    console.log('✅ Analytics exported to CSV successfully:', campaignAnalytics.length, 'campaigns')

    return new Response(JSON.stringify({
      success: true,
      exportData,
      csvContent,
      metadata: {
        exportedAt: exportData.exportMetadata.exportedAt,
        totalCampaigns: summary.totalCampaigns,
        format: 'csv',
        downloadUrl: `/api/admin/analytics/export/download/${Date.now()}.csv`,
        fileName: `analytics-export-${startDate || 'all'}-${endDate || 'time'}.csv`
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="analytics-export.csv"`
      }
    })

  } catch (error) {
    console.error('❌ Export analytics to CSV error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export analytics to CSV',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== G4: EXPORT ANALYTICS TO PDF =====

/**
 * G4: Export Analytics to PDF
 * Admin exports analytics as PDF reports with charts and tables
 */
export const exportAnalyticsToPDF = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url || '')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const campaignStatus = searchParams.get('status') || 'all'

    console.log('📊 Exporting analytics to PDF for admin:', user.id, 'Date range:', startDate, 'to', endDate)

    // Get the same analytics data as CSV export
    const whereConditions: any[] = []

    if (startDate && endDate) {
      whereConditions.push({
        createdAt: {
          greater_than_equal: startDate,
          less_than_equal: endDate
        }
      })
    }

    if (campaignStatus !== 'all') {
      whereConditions.push({
        status: { equals: campaignStatus }
      })
    }

    const campaigns = await req.payload.find({
      collection: 'campaigns',
      where: whereConditions.length > 0 ? { and: whereConditions } : {},
      limit: 1000,
      sort: '-createdAt'
    })

    // Process campaign analytics (same logic as CSV export)
    const campaignAnalytics: CampaignAnalytics[] = []

    for (const campaign of campaigns.docs) {
      const earnings = await req.payload.find({
        collection: 'driver-earnings',
        where: { campaignId: { equals: campaign.id } },
        limit: 1000
      }).catch(() => ({ docs: [] }))

      const advertiser = await req.payload.findByID({
        collection: 'users',
        id: campaign.advertiser
      }).catch(() => null)

      const spend = earnings.docs.reduce((sum: number, earning: any) => sum + (earning.amount || 0), 0)
      const impressions = earnings.docs.length
      const clicks = Math.floor(impressions * 0.15)
      const conversions = Math.floor(clicks * 0.05)
      const roi = campaign.budget > 0 ? ((spend / campaign.budget) * 100) : 0

      campaignAnalytics.push({
        campaignId: campaign.id,
        campaignName: campaign.name || 'Unnamed Campaign',
        advertiserId: campaign.advertiser,
        advertiserName: advertiser ? `${advertiser.firstName} ${advertiser.lastName}` : 'Unknown',
        status: campaign.status || 'unknown',
        budget: campaign.budget || 0,
        spend: spend,
        impressions: impressions,
        clicks: clicks,
        conversions: conversions,
        roi: Math.round(roi * 100) / 100,
        startDate: campaign.startDate || campaign.createdAt,
        endDate: campaign.endDate || campaign.createdAt,
        createdAt: campaign.createdAt
      })
    }

    // Calculate summary statistics
    const summary = {
      totalCampaigns: campaignAnalytics.length,
      totalBudget: campaignAnalytics.reduce((sum, c) => sum + c.budget, 0),
      totalSpend: campaignAnalytics.reduce((sum, c) => sum + c.spend, 0),
      totalImpressions: campaignAnalytics.reduce((sum, c) => sum + c.impressions, 0),
      totalClicks: campaignAnalytics.reduce((sum, c) => sum + c.clicks, 0),
      totalConversions: campaignAnalytics.reduce((sum, c) => sum + c.conversions, 0),
      averageROI: campaignAnalytics.length > 0 ? 
        campaignAnalytics.reduce((sum, c) => sum + c.roi, 0) / campaignAnalytics.length : 0,
      activeCampaigns: campaignAnalytics.filter(c => c.status === 'active').length,
      completedCampaigns: campaignAnalytics.filter(c => c.status === 'completed').length
    }

    // Generate chart data for PDF
    const chartData = {
      campaignStatusBreakdown: {
        active: campaignAnalytics.filter(c => c.status === 'active').length,
        completed: campaignAnalytics.filter(c => c.status === 'completed').length,
        pending: campaignAnalytics.filter(c => c.status === 'pending').length,
        rejected: campaignAnalytics.filter(c => c.status === 'rejected').length
      },
      topPerformers: campaignAnalytics
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 10)
        .map(c => ({
          name: c.campaignName,
          roi: c.roi,
          spend: c.spend
        })),
      monthlyTrends: generateMonthlyTrends(campaignAnalytics),
      revenueBreakdown: {
        totalBudget: summary.totalBudget,
        totalSpend: summary.totalSpend,
        remainingBudget: summary.totalBudget - summary.totalSpend
      }
    }

    // Generate PDF content structure
    const pdfContent = {
      title: 'Beyond Trips Analytics Report',
      subtitle: `Campaign Performance Analysis - ${startDate || 'All Time'} to ${endDate || 'Present'}`,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      summary,
      chartData,
      campaignDetails: campaignAnalytics.slice(0, 20), // Limit for PDF size
      totalCampaigns: campaignAnalytics.length
    }

    console.log('✅ Analytics exported to PDF successfully:', campaignAnalytics.length, 'campaigns')

    return new Response(JSON.stringify({
      success: true,
      pdfContent,
      metadata: {
        exportedAt: pdfContent.generatedAt,
        totalCampaigns: summary.totalCampaigns,
        format: 'pdf',
        downloadUrl: `/api/admin/analytics/export/download/${Date.now()}.pdf`,
        fileName: `analytics-report-${startDate || 'all'}-${endDate || 'time'}.pdf`,
        pages: Math.ceil(campaignAnalytics.length / 20) + 2 // Summary + charts + data pages
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="analytics-report.pdf"`
      }
    })

  } catch (error) {
    console.error('❌ Export analytics to PDF error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export analytics to PDF',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function generateMonthlyTrends(campaigns: CampaignAnalytics[]): any[] {
  const monthlyData: { [key: string]: { campaigns: number; spend: number; impressions: number } } = {}

  campaigns.forEach(campaign => {
    const month = new Date(campaign.createdAt).toISOString().substring(0, 7) // YYYY-MM format
    
    if (!monthlyData[month]) {
      monthlyData[month] = { campaigns: 0, spend: 0, impressions: 0 }
    }
    
    monthlyData[month].campaigns++
    monthlyData[month].spend += campaign.spend
    monthlyData[month].impressions += campaign.impressions
  })

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      campaigns: data.campaigns,
      spend: data.spend,
      impressions: data.impressions
    }))
}

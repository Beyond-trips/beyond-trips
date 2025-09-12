// endpoints/advertiserDashboardEndpoints.ts

import type { PayloadRequest } from 'payload'

// Helper function to parse request body
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

// Get advertiser dashboard overview
export const getAdvertiserDashboardOverview = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Getting advertiser dashboard overview for:', user!.id)

    // Get business details (advertiser profile) by email
    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const advertiserProfile = advertiser.docs[0]

    // Get campaigns
    const campaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: { businessId: { equals: advertiserProfile.id } }
    })

    // Calculate stats
    const totalCampaigns = campaigns.docs.length
    const activeCampaigns = campaigns.docs.filter((c: any) => c.status === 'active').length

    return new Response(JSON.stringify({
      success: true,
      overview: {
        advertiser: {
          id: advertiserProfile.id,
          companyName: advertiserProfile.companyName,
          companyEmail: advertiserProfile.companyEmail,
          companyAddress: advertiserProfile.companyAddress,
          contact: advertiserProfile.contact,
          industry: advertiserProfile.industry,
          emailVerified: advertiserProfile.emailVerified,
          status: 'active',
        },
        stats: {
          totalCampaigns,
          activeCampaigns,
          totalSpent: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          engagementRate: 0,
          clickThroughRate: 0,
          conversionRate: 0,
          totalAdvertisements: 0,
          activeAdvertisements: 0,
        },
        recentCampaigns: [],
        recentPayments: [],
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get advertiser dashboard overview error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get dashboard overview'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get advertiser profile
export const getAdvertiserProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('👤 Getting advertiser profile for:', user!.id)

    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const advertiserProfile = advertiser.docs[0]

    return new Response(JSON.stringify({
      success: true,
      profile: {
        id: advertiserProfile.id,
        companyName: advertiserProfile.companyName,
        companyEmail: advertiserProfile.companyEmail,
        companyAddress: advertiserProfile.companyAddress,
        contact: advertiserProfile.contact,
        industry: advertiserProfile.industry,
        emailVerified: advertiserProfile.emailVerified,
        status: 'active',
        createdAt: advertiserProfile.createdAt,
        updatedAt: advertiserProfile.updatedAt,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get advertiser profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get advertiser profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Create campaign
export const createCampaign = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      campaignName,
      campaignDescription,
      campaignType,
      budget,
      startDate,
      endDate,
      targetAudience
    } = body

    if (!campaignName || !campaignDescription || !campaignType) {
      return new Response(JSON.stringify({
        error: 'Campaign name, description, and type are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📈 Creating campaign for advertiser:', user!.id)

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    const campaign = await req.payload.create({
      collection: 'ad-campaigns',
      data: {
        businessId: businessId,
        campaignName,
        campaignDescription,
        campaignType,
        budget: budget || 0,
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        targetAudience: targetAudience || 'General audience',
        status: 'draft'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign created successfully',
      campaign: {
        id: campaign.id,
        name: campaign.campaignName,
        description: campaign.campaignDescription,
        type: campaign.campaignType,
        status: campaign.status,
        createdAt: campaign.createdAt,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create campaign error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create campaign'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get campaigns
export const getCampaigns = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('📈 Getting campaigns for advertiser:', user!.id)

    // Get business details (advertiser profile) by email
    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const campaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: { businessId: { equals: advertiser.docs[0].id } },
      sort: '-createdAt'
    })

    return new Response(JSON.stringify({
      success: true,
      campaigns: campaigns.docs.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.campaignName,
        description: campaign.campaignDescription,
        type: campaign.campaignType,
        status: campaign.status,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get campaigns error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get campaigns'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== ANALYTICS ENDPOINTS =====

// Get comprehensive analytics
export const getAnalytics = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const period = searchParams.get('period') || '30' // days
    const campaignId = searchParams.get('campaignId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    console.log('📊 Getting analytics for advertiser:', user!.id)

    // Get business details (advertiser profile) by email
    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build date filter
    const dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter.date = {
        greater_than_equal: startDate,
        less_than_equal: endDate
      }
    } else {
      const days = parseInt(period)
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      dateFilter.date = {
        greater_than_equal: startDate.toISOString(),
        less_than_equal: endDate.toISOString()
      }
    }

    // Build analytics query
    const analyticsWhere: any = {
      businessId: { equals: advertiser.docs[0].id },
      ...dateFilter
    }

    if (campaignId) {
      analyticsWhere.campaignId = { equals: campaignId }
    }

    // Get analytics data
    const analyticsData = await req.payload.find({
      collection: 'analytics-data' as any,
      where: analyticsWhere,
      sort: '-date'
    })

    // Calculate summary metrics
    const totalImpressions = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0)
    const totalClicks = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0)
    const totalConversions = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0)
    const totalSpend = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)

    const engagementRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const clickThroughRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    const costPerClick = totalClicks > 0 ? totalSpend / totalClicks : 0
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0
    const costPerMille = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0

    // Generate daily stats for the period
    const dailyStats = []
    const days = parseInt(period)
    const today = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      // Filter analytics data for this specific date
      const dayData = analyticsData.docs.filter((data: any) => {
        const dataDate = new Date(data.date)
        return dataDate.toDateString() === date.toDateString()
      })

      const dayImpressions = dayData.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0)
      const dayClicks = dayData.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0)
      const dayConversions = dayData.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0)
      const daySpend = dayData.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)
      
      dailyStats.push({
        date: date.toISOString().split('T')[0],
        impressions: dayImpressions,
        clicks: dayClicks,
        conversions: dayConversions,
        spend: daySpend,
        engagementRate: dayImpressions > 0 ? (dayClicks / dayImpressions) * 100 : 0,
        clickThroughRate: dayImpressions > 0 ? (dayClicks / dayImpressions) * 100 : 0,
        conversionRate: dayClicks > 0 ? (dayConversions / dayClicks) * 100 : 0,
        costPerClick: dayClicks > 0 ? daySpend / dayClicks : 0,
        costPerConversion: dayConversions > 0 ? daySpend / dayConversions : 0,
        costPerMille: dayImpressions > 0 ? (daySpend / dayImpressions) * 1000 : 0,
      })
    }

    // Get campaigns for campaign performance
    const campaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: { businessId: { equals: advertiser.docs[0].id } }
    })

    // Calculate campaign performance
    const campaignPerformance = campaigns.docs.map((campaign: any) => {
      const campaignAnalytics = analyticsData.docs.filter((data: any) => data.campaignId === campaign.id)
      
      const campaignImpressions = campaignAnalytics.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0)
      const campaignClicks = campaignAnalytics.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0)
      const campaignConversions = campaignAnalytics.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0)
      const campaignSpend = campaignAnalytics.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)
      
      return {
        id: campaign.id,
        name: campaign.campaignName,
        type: campaign.campaignType,
        status: campaign.status,
        impressions: campaignImpressions,
        clicks: campaignClicks,
        conversions: campaignConversions,
        spend: campaignSpend,
        engagementRate: campaignImpressions > 0 ? (campaignClicks / campaignImpressions) * 100 : 0,
        clickThroughRate: campaignImpressions > 0 ? (campaignClicks / campaignImpressions) * 100 : 0,
        conversionRate: campaignClicks > 0 ? (campaignConversions / campaignClicks) * 100 : 0,
        costPerClick: campaignClicks > 0 ? campaignSpend / campaignClicks : 0,
        costPerConversion: campaignConversions > 0 ? campaignSpend / campaignConversions : 0,
        costPerMille: campaignImpressions > 0 ? (campaignSpend / campaignImpressions) * 1000 : 0,
        budget: {
          totalBudget: campaign.budget || 0,
          spent: campaignSpend,
          remaining: Math.max(0, (campaign.budget || 0) - campaignSpend)
        },
      }
    })

    return new Response(JSON.stringify({
      success: true,
      analytics: {
        summary: {
          totalImpressions,
          totalClicks,
          totalConversions,
          totalSpend,
          engagementRate: Math.round(engagementRate * 100) / 100,
          clickThroughRate: Math.round(clickThroughRate * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          costPerClick: Math.round(costPerClick * 100) / 100,
          costPerConversion: Math.round(costPerConversion * 100) / 100,
          costPerMille: Math.round(costPerMille * 100) / 100,
        },
        dailyStats,
        campaignPerformance,
        period: `${period} days`,
        dateRange: {
          startDate: startDate || new Date(today.getTime() - (parseInt(period) * 24 * 60 * 60 * 1000)).toISOString(),
          endDate: endDate || today.toISOString()
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get analytics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get analytics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get ad spend data for charts
export const getAdSpendData = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const period = searchParams.get('period') || '30' // days
    const granularity = searchParams.get('granularity') || 'daily' // daily, weekly, monthly

    console.log('💰 Getting ad spend data for advertiser:', user!.id)

    // Get business details (advertiser profile) by email
    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build date filter
    const days = parseInt(period)
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

    // Get analytics data
    const analyticsData = await req.payload.find({
      collection: 'analytics-data' as any,
      where: {
        businessId: { equals: advertiser.docs[0].id },
        date: {
          greater_than_equal: startDate.toISOString(),
          less_than_equal: endDate.toISOString()
        }
      },
      sort: 'date'
    })

    // Group data by granularity
    const spendData: any[] = []
    
    if (granularity === 'daily') {
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        
        const dayData = analyticsData.docs.filter((data: any) => {
          const dataDate = new Date(data.date)
          return dataDate.toDateString() === date.toDateString()
        })

        const daySpend = dayData.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)
        
        spendData.push({
          date: date.toISOString().split('T')[0],
          spend: daySpend,
          impressions: dayData.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0),
          clicks: dayData.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0),
          conversions: dayData.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0),
        })
      }
    } else if (granularity === 'weekly') {
      const weeks = Math.ceil(days / 7)
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(startDate)
        weekStart.setDate(weekStart.getDate() + (i * 7))
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const weekData = analyticsData.docs.filter((data: any) => {
          const dataDate = new Date(data.date)
          return dataDate >= weekStart && dataDate <= weekEnd
        })

        const weekSpend = weekData.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)
        
        spendData.push({
          week: `Week ${i + 1}`,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          spend: weekSpend,
          impressions: weekData.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0),
          clicks: weekData.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0),
          conversions: weekData.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0),
        })
      }
    } else if (granularity === 'monthly') {
      const months = Math.ceil(days / 30)
      for (let i = 0; i < months; i++) {
        const monthStart = new Date(startDate)
        monthStart.setMonth(monthStart.getMonth() + i)
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        monthEnd.setDate(0) // Last day of the month

        const monthData = analyticsData.docs.filter((data: any) => {
          const dataDate = new Date(data.date)
          return dataDate >= monthStart && dataDate <= monthEnd
        })

        const monthSpend = monthData.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)
        
        spendData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          startDate: monthStart.toISOString().split('T')[0],
          endDate: monthEnd.toISOString().split('T')[0],
          spend: monthSpend,
          impressions: monthData.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0),
          clicks: monthData.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0),
          conversions: monthData.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0),
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      spendData: {
        data: spendData,
        granularity,
        period: `${period} days`,
        totalSpend: spendData.reduce((sum: number, item: any) => sum + item.spend, 0),
        averageDailySpend: granularity === 'daily' ? spendData.reduce((sum: number, item: any) => sum + item.spend, 0) / days : null,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get ad spend data error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get ad spend data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Generate analytics report
export const generateReport = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      reportType = 'campaign_performance',
      format = 'json',
      startDate,
      endDate,
      campaignIds = [],
      includeCharts = true
    } = body

    console.log('📊 Generating analytics report for advertiser:', user!.id)

    // Get business details (advertiser profile) by email
    const advertiser = await req.payload.find({
      collection: 'business-details',
      where: { companyEmail: { equals: user!.email } },
      limit: 1
    })

    if (advertiser.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build analytics query
    const analyticsWhere: any = {
      businessId: { equals: advertiser.docs[0].id }
    }

    if (startDate && endDate) {
      analyticsWhere.date = {
        greater_than_equal: startDate,
        less_than_equal: endDate
      }
    }

    if (campaignIds.length > 0) {
      analyticsWhere.campaignId = { in: campaignIds }
    }

    // Get analytics data
    const analyticsData = await req.payload.find({
      collection: 'analytics-data' as any,
      where: analyticsWhere,
      sort: '-date'
    })

    // Get campaigns
    const campaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: { businessId: { equals: advertiser.docs[0].id } }
    })

    // Calculate report data
    const totalImpressions = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0)
    const totalClicks = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0)
    const totalConversions = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0)
    const totalSpend = analyticsData.docs.reduce((sum: number, data: any) => sum + (data.spend || 0), 0)

    const reportData = {
      reportId: `RPT-${Date.now()}`,
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: advertiser.docs[0].companyName,
      dateRange: {
        startDate: startDate || (analyticsData.docs[analyticsData.docs.length - 1] as any)?.date,
        endDate: endDate || (analyticsData.docs[0] as any)?.date
      },
      summary: {
        totalImpressions,
        totalClicks,
        totalConversions,
        totalSpend,
        engagementRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        clickThroughRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
        costPerClick: totalClicks > 0 ? totalSpend / totalClicks : 0,
        costPerConversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
        costPerMille: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      },
      campaigns: campaigns.docs.map((campaign: any) => {
        const campaignAnalytics = analyticsData.docs.filter((data: any) => data.campaignId === campaign.id)
        
        return {
          id: campaign.id,
          name: campaign.campaignName,
          type: campaign.campaignType,
          status: campaign.status,
          impressions: campaignAnalytics.reduce((sum: number, data: any) => sum + (data.impressions || 0), 0),
          clicks: campaignAnalytics.reduce((sum: number, data: any) => sum + (data.clicks || 0), 0),
          conversions: campaignAnalytics.reduce((sum: number, data: any) => sum + (data.conversions || 0), 0),
          spend: campaignAnalytics.reduce((sum: number, data: any) => sum + (data.spend || 0), 0),
        }
      }),
      rawData: includeCharts ? analyticsData.docs : undefined
    }

    // Generate report based on format
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Date,Campaign,Impressions,Clicks,Conversions,Spend,Engagement Rate,CTR,Conversion Rate,CPC,CPM'
      const csvRows = analyticsData.docs.map((data: any) => {
        const campaign = campaigns.docs.find((c: any) => c.id === data.campaignId)
        return `${data.date},${campaign?.campaignName || 'Unknown'},${data.impressions},${data.clicks},${data.conversions},${data.spend},${data.engagementRate},${data.clickThroughRate},${data.conversionRate},${data.costPerClick},${data.costPerMille}`
      }).join('\n')
      
      const csvContent = csvHeaders + '\n' + csvRows
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-report-${Date.now()}.csv"`
        }
      })
    } else {
      // Return JSON format
      return new Response(JSON.stringify({
        success: true,
        report: reportData
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('❌ Generate report error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate report'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Add analytics data (for testing/admin use)
export const addAnalyticsData = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      campaignId,
      impressions,
      clicks,
      conversions,
      spend,
      source = 'magazine',
      deviceType = 'all',
      location,
      ageGroup = 'all',
      gender = 'all',
      notes
    } = body

    if (!campaignId || impressions === undefined || clicks === undefined) {
      return new Response(JSON.stringify({
        error: 'Campaign ID, impressions, and clicks are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Adding analytics data for campaign:', campaignId)

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Verify campaign belongs to advertiser
    const campaign = await req.payload.findByID({
      collection: 'ad-campaigns',
      id: campaignId
    })

    if (typeof campaign.businessId === 'object' && campaign.businessId?.id !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const analyticsData = await req.payload.create({
      collection: 'analytics-data' as any,
      data: {
        campaignId,
        businessId: businessId,
        date: new Date().toISOString(),
        impressions: impressions || 0,
        clicks: clicks || 0,
        conversions: conversions || 0,
        spend: spend || 0,
        source,
        deviceType,
        location,
        ageGroup,
        gender,
        notes,
        currency: 'NGN'
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Analytics data added successfully',
      data: {
        id: analyticsData.id,
        campaignId: (analyticsData as any).campaignId,
        impressions: (analyticsData as any).impressions,
        clicks: (analyticsData as any).clicks,
        conversions: (analyticsData as any).conversions,
        spend: (analyticsData as any).spend,
        engagementRate: (analyticsData as any).engagementRate,
        clickThroughRate: (analyticsData as any).clickThroughRate,
        conversionRate: (analyticsData as any).conversionRate,
        costPerClick: (analyticsData as any).costPerClick,
        costPerConversion: (analyticsData as any).costPerConversion,
        costPerMille: (analyticsData as any).costPerMille,
        date: (analyticsData as any).date
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Add analytics data error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add analytics data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== FILE UPLOAD ENDPOINTS =====

// Upload campaign media files
export const uploadCampaignMediaFile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      campaignId,
      fileType,
      fileName,
      fileSize,
      fileUrl,
      description,
      fileData // Base64 encoded file data
    } = body

    if (!campaignId || !fileType || !fileName || !fileData) {
      return new Response(JSON.stringify({
        error: 'Campaign ID, file type, file name, and file data are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file type
    const allowedTypes = ['pdf', 'jpeg', 'jpg', 'png', 'gif', 'mp4', 'mov', 'avi']
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return new Response(JSON.stringify({
        error: 'Invalid file type. Allowed types: PDF, JPEG, PNG, GIF, MP4, MOV, AVI'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file size (10MB max for media files)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (fileSize && fileSize > maxSize) {
      return new Response(JSON.stringify({
        error: 'File size exceeds 10MB limit'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📁 Uploading campaign media file:', fileName)

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Verify campaign belongs to advertiser
    const campaign = await req.payload.findByID({
      collection: 'ad-campaigns',
      id: campaignId
    })

    if (typeof campaign.businessId === 'object' && campaign.businessId?.id !== businessId) {
      return new Response(JSON.stringify({
        error: 'Campaign not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate file URL if not provided
    const finalFileUrl = fileUrl || `https://api.beyond-trips.com/uploads/campaigns/${campaignId}/${fileName}`

    // Create campaign media record
    const mediaFile = await req.payload.create({
      collection: 'campaign-media' as any,
      data: {
        campaignId,
        businessId: businessId,
        fileName,
        fileType: fileType.toLowerCase(),
        fileUrl: finalFileUrl,
        fileSize: fileSize || 0,
        description: description || '',
        uploadStatus: 'completed',
        isApproved: false,
        uploadedAt: new Date().toISOString()
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Campaign media file uploaded successfully',
      data: {
        id: mediaFile.id,
        campaignId: (mediaFile as any).campaignId,
        fileName: (mediaFile as any).fileName,
        fileType: (mediaFile as any).fileType,
        fileUrl: (mediaFile as any).fileUrl,
        fileSize: (mediaFile as any).fileSize,
        uploadStatus: (mediaFile as any).uploadStatus,
        uploadedAt: (mediaFile as any).uploadedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload campaign media file error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload campaign media file'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Upload profile picture
export const uploadProfilePicture = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      fileType,
      fileName,
      fileSize,
      fileUrl,
      fileData // Base64 encoded file data
    } = body

    if (!fileType || !fileName || !fileData) {
      return new Response(JSON.stringify({
        error: 'File type, file name, and file data are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file type (only images for profile pictures)
    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif']
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return new Response(JSON.stringify({
        error: 'Invalid file type. Only JPEG, PNG, and GIF images are allowed for profile pictures'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file size (2MB max for profile pictures)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (fileSize && fileSize > maxSize) {
      return new Response(JSON.stringify({
        error: 'File size exceeds 2MB limit for profile pictures'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📸 Uploading profile picture:', fileName)

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Generate file URL if not provided
    const finalFileUrl = fileUrl || `https://api.beyond-trips.com/uploads/profiles/${businessId}/${fileName}`

    // Update business profile with new profile picture
    const updatedProfile = await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: finalFileUrl,
        profilePictureUpdatedAt: new Date().toISOString()
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: (updatedProfile as any).profilePicture,
        profilePictureUpdatedAt: (updatedProfile as any).profilePictureUpdatedAt,
        fileName,
        fileType: fileType.toLowerCase(),
        fileSize: fileSize || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload profile picture error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload profile picture'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

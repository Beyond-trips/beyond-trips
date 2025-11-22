import { PayloadRequest } from 'payload'

/**
 * QR Scan Analytics Interface
 * NOTE: Earnings removed - scans are for tracking only
 * Drivers earn through BTL coins, not scans
 */
interface QRScanAnalytics {
  totalScans: number
  uniqueMagazines: number
  uniqueCampaigns: number
  fraudPreventionStats: {
    totalChecks: number
    blockedScans: number
    riskScoreDistribution: {
      low: number
      medium: number
      high: number
    }
  }
  timeBasedStats: {
    dailyScans: Array<{
      date: string
      scans: number
    }>
    hourlyDistribution: Array<{
      hour: number
      scans: number
    }>
  }
  locationStats: {
    topLocations: Array<{
      location: string
      scans: number
    }>
    geographicDistribution: Array<{
      region: string
      scans: number
    }>
  }
}

/**
 * QR Scan History Interface
 * NOTE: Earnings field removed - scans are for tracking only
 */
interface QRScanHistory {
  scanId: string
  driverId?: string
  qrCode: string
  magazineName: string
  campaignName: string
  scannedAt: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  fraudCheck: {
    riskScore: number
    checks: string[]
    passed: boolean
  }
  status: 'completed' | 'blocked' | 'pending'
}

// ===== QR4: QR SCAN HISTORY TRACKING =====

/**
 * QR4: QR Scan History Tracking
 * Comprehensive tracking and logging of all QR scans
 */
export const getQRScanHistory = async (req: PayloadRequest): Promise<Response> => {
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

    const { searchParams } = new URL(req.url || '')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status') || 'all'
    const userRole = searchParams.get('role') || user.role

    console.log('📊 Getting QR scan history for user:', user.id, 'Role:', userRole)

    // Build where conditions based on user role
    let whereConditions: any[] = []

    if (userRole === 'driver') {
      whereConditions.push({ driver: { equals: user.id } })
    } else if (userRole === 'advertiser') {
      // Get advertiser's campaigns and their scans
      const advertiserCampaigns = await req.payload.find({
        collection: 'campaigns',
        where: { advertiser: { equals: user.id } },
        limit: 1000
      })
      
      const campaignIds = advertiserCampaigns.docs.map(c => c.id)
      if (campaignIds.length > 0) {
        whereConditions.push({ campaign: { in: campaignIds } })
      }
    } else if (userRole === 'admin') {
      // Admin can see all scans
      whereConditions = []
    }

    // Add date range filter
    if (startDate && endDate) {
      whereConditions.push({
        scannedAt: {
          greater_than_equal: startDate,
          less_than_equal: endDate
        }
      })
    }

    // Add status filter
    if (status !== 'all') {
      whereConditions.push({ status: { equals: status } })
    }

    // Get QR scans
    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: whereConditions.length > 0 ? { and: whereConditions } : {},
      sort: '-scannedAt',
      limit,
      page: Math.floor(offset / limit) + 1
    })

    // Process scan history (no earnings - scans are for tracking only)
    const scanHistory: QRScanHistory[] = scans.docs.map((scan: any) => ({
      scanId: scan.id,
      driverId: scan.driver,
      qrCode: scan.qrCode,
      magazineName: scan.magazineName || 'Unknown Magazine',
      campaignName: scan.campaignName || 'Unknown Campaign',
      scannedAt: scan.scannedAt || scan.createdAt,
      location: scan.location ? {
        latitude: scan.location.latitude,
        longitude: scan.location.longitude,
        address: scan.location.address
      } : undefined,
      fraudCheck: {
        riskScore: scan.fraudCheck?.riskScore || 0,
        checks: scan.fraudCheck?.checks || [],
        passed: scan.fraudCheck?.passed || true
      },
      status: scan.status || 'completed'
    }))

    // Calculate summary statistics
    const summary = {
      totalScans: scans.totalDocs,
      totalEarnings: scanHistory.reduce((sum, scan) => sum + scan.earnings, 0),
      successfulScans: scanHistory.filter(s => s.status === 'completed').length,
      blockedScans: scanHistory.filter(s => s.status === 'blocked').length,
      averageRiskScore: scanHistory.length > 0 ? 
        scanHistory.reduce((sum, s) => sum + s.fraudCheck.riskScore, 0) / scanHistory.length : 0
    }

    console.log('✅ Retrieved QR scan history:', scanHistory.length, 'scans')

    return new Response(JSON.stringify({
      success: true,
      scanHistory,
      summary,
      pagination: {
        limit,
        offset,
        total: scans.totalDocs,
        hasMore: offset + limit < scans.totalDocs
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get QR scan history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get QR scan history',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== QR5: QR SCAN ANALYTICS DASHBOARD =====

/**
 * QR5: QR Scan Analytics Dashboard
 * Comprehensive analytics and insights for QR scanning
 */
export const getQRScanAnalytics = async (req: PayloadRequest): Promise<Response> => {
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

    const { searchParams } = new URL(req.url || '')
    const period = searchParams.get('period') || 'month' // week, month, year, all
    const userRole = searchParams.get('role') || user.role

    console.log('📊 Getting QR scan analytics for user:', user.id, 'Period:', period, 'Role:', userRole)

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(0) // All time
    }

    // Get all scans for the period
    const whereConditions: any[] = [
      { scannedAt: { greater_than_equal: startDate.toISOString() } }
    ]

    if (userRole === 'driver') {
      whereConditions.push({ driver: { equals: user.id } })
    } else if (userRole === 'advertiser') {
      // Get advertiser's campaigns
      const advertiserCampaigns = await req.payload.find({
        collection: 'campaigns',
        where: { advertiser: { equals: user.id } },
        limit: 1000
      })
      
      const campaignIds = advertiserCampaigns.docs.map(c => c.id)
      if (campaignIds.length > 0) {
        whereConditions.push({ campaign: { in: campaignIds } })
      }
    }

    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: { and: whereConditions },
      limit: 1000,
      sort: '-scannedAt'
    })

    // Calculate basic statistics (earnings removed - scans are for tracking only)
    const totalScans = scans.docs.length
    
    // Get unique magazines and campaigns
    const uniqueMagazines = new Set(scans.docs.map((s: any) => s.magazineName)).size
    const uniqueCampaigns = new Set(scans.docs.map((s: any) => s.campaign)).size

    // Calculate fraud prevention statistics
    const fraudStats = calculateFraudPreventionStats(scans.docs)

    // Calculate time-based statistics (no earnings tracking)
    const timeStats = calculateTimeBasedStats(scans.docs, period)

    // Calculate location statistics
    const locationStats = calculateLocationStats(scans.docs)

    const analytics: QRScanAnalytics = {
      totalScans,
      uniqueMagazines,
      uniqueCampaigns,
      fraudPreventionStats: fraudStats,
      timeBasedStats: timeStats,
      locationStats: locationStats
    }

    console.log('✅ Generated QR scan analytics:', totalScans, 'scans analyzed')

    return new Response(JSON.stringify({
      success: true,
      analytics,
      period: getPeriodLabel(period),
      generatedAt: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get QR scan analytics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get QR scan analytics',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function calculateFraudPreventionStats(scans: any[]): any {
  const totalChecks = scans.length
  const blockedScans = scans.filter(s => s.status === 'blocked').length
  
  const riskScores = scans.map(s => s.fraudCheck?.riskScore || 0)
  const lowRisk = riskScores.filter(score => score < 25).length
  const mediumRisk = riskScores.filter(score => score >= 25 && score < 50).length
  const highRisk = riskScores.filter(score => score >= 50).length

  return {
    totalChecks,
    blockedScans,
    riskScoreDistribution: {
      low: lowRisk,
      medium: mediumRisk,
      high: highRisk
    }
  }
}

function calculateTimeBasedStats(scans: any[], period: string): any {
  // Earnings tracking removed - scans are for analytics only
  const dailyStatsMap: { [key: string]: { scans: number } } = {}
  const hourlyStatsMap: { [key: number]: number } = {}

  scans.forEach(scan => {
    const scanDate = new Date(scan.scannedAt || scan.createdAt)
    const dateKey = scanDate.toISOString().substring(0, 10)
    const hour = scanDate.getHours()

    // Daily stats (no earnings)
    if (!dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey] = { scans: 0 }
    }
    dailyStatsMap[dateKey].scans++

    // Hourly stats
    hourlyStatsMap[hour] = (hourlyStatsMap[hour] || 0) + 1
  })

  const dailyStats = Object.entries(dailyStatsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }))

  const hourlyDistribution = Object.entries(hourlyStatsMap)
    .map(([hour, scans]) => ({ hour: parseInt(hour), scans }))
    .sort((a, b) => a.hour - b.hour)

  return {
    dailyScans: dailyStats,
    hourlyDistribution
  }
}

function calculateLocationStats(scans: any[]): any {
  const locationMap: { [key: string]: number } = {}
  const regionMap: { [key: string]: number } = {}

  scans.forEach(scan => {
    if (scan.location?.address) {
      const location = scan.location.address
      locationMap[location] = (locationMap[location] || 0) + 1
      
      // Simple region extraction (in real implementation, this would be more sophisticated)
      const region = extractRegionFromAddress(location)
      regionMap[region] = (regionMap[region] || 0) + 1
    }
  })

  const topLocations = Object.entries(locationMap)
    .map(([location, scans]) => ({ location, scans }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 10)

  const geographicDistribution = Object.entries(regionMap)
    .map(([region, scans]) => ({ region, scans }))
    .sort((a, b) => b.scans - a.scans)

  return {
    topLocations,
    geographicDistribution
  }
}

function extractRegionFromAddress(address: string): string {
  // Simple region extraction - in real implementation, this would use geocoding
  if (address.toLowerCase().includes('lagos')) return 'Lagos'
  if (address.toLowerCase().includes('abuja')) return 'Abuja'
  if (address.toLowerCase().includes('kano')) return 'Kano'
  return 'Other'
}

function getPeriodLabel(period: string): string {
  const now = new Date()
  
  switch (period) {
    case 'week':
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return `Last 7 Days (${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()})`
    case 'month':
      return `This Month (${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
    case 'year':
      return `This Year (${now.getFullYear()})`
    default:
      return 'All Time'
  }
}

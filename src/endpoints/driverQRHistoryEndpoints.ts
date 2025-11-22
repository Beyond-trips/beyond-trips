import { PayloadRequest } from 'payload'

interface QRScanRecord {
  scanId: string
  driverId: string
  magazineId: string
  magazineName: string
  campaignId: string
  campaignName: string
  earnings: number
  scannedAt: string
  status: 'completed' | 'pending' | 'failed'
  location?: {
    latitude?: number
    longitude?: number
    address?: string
  }
}

interface ScanStatistics {
  totalScans: number
  totalEarnings: number
  averageEarningsPerScan: number
  period: string
  dailyStats: {
    date: string
    scans: number
    earnings: number
  }[]
  topMagazines: {
    magazineName: string
    scans: number
    earnings: number
    averagePerScan: number
  }[]
  trends: {
    weeklyGrowth: number
    monthlyGrowth: number
    bestDay: string
    bestMagazine: string
  }
}

// ===== QR2: DRIVER SCAN HISTORY DASHBOARD =====

/**
 * QR2: View Driver Scan History Dashboard
 * Driver views complete scan history with filtering and sorting
 */
export const getDriverScanHistory = async (req: PayloadRequest): Promise<Response> => {
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
    const sort = searchParams.get('sort') || 'date'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const magazineFilter = searchParams.get('magazine')

    console.log('📱 Getting QR scan history for driver:', user.id, 'Sort:', sort, 'Order:', order)

    // Build where conditions
    const whereConditions: any[] = [
      { driver: { equals: user.id } }
    ]

    if (startDate && endDate) {
      whereConditions.push({
        scannedAt: {
          greater_than_equal: startDate,
          less_than_equal: endDate
        }
      })
    }

    if (magazineFilter) {
      whereConditions.push({
        magazineName: { like: magazineFilter }
      })
    }

    // Get QR scans
    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: { and: whereConditions },
      sort: sort === 'date' ? (order === 'desc' ? '-scannedAt' : 'scannedAt') : 
            sort === 'earnings' ? (order === 'desc' ? '-earnings' : 'earnings') : '-scannedAt',
      limit,
      page: Math.floor(offset / limit) + 1
    })

    // Process scan records
    const scanHistory: QRScanRecord[] = scans.docs.map((scan: any) => ({
      scanId: scan.id,
      driverId: scan.driver,
      magazineId: scan.magazine,
      magazineName: scan.magazineName || 'Unknown Magazine',
      campaignId: scan.campaign || 'Unknown Campaign',
      campaignName: scan.campaignName || 'Unknown Campaign',
      earnings: scan.earnings || 500, // Default ₦500 per scan
      scannedAt: scan.scannedAt || scan.createdAt,
      status: scan.status || 'completed',
      location: scan.location ? {
        latitude: scan.location.latitude,
        longitude: scan.location.longitude,
        address: scan.location.address
      } : undefined
    }))

    // Calculate totals
    const totalEarnings = scanHistory.reduce((sum, scan) => sum + scan.earnings, 0)

    console.log('✅ Retrieved', scanHistory.length, 'QR scans for driver:', user.id)

    return new Response(JSON.stringify({
      success: true,
      scanHistory,
      pagination: {
        limit,
        offset,
        total: scans.totalDocs,
        hasMore: offset + limit < scans.totalDocs
      },
      summary: {
        totalScans: scans.totalDocs,
        totalEarnings,
        averagePerScan: scans.totalDocs > 0 ? Math.round((totalEarnings / scans.totalDocs) * 100) / 100 : 0,
        period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver scan history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get scan history',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== QR2: SCAN STATISTICS =====

/**
 * QR2: Scan Statistics
 * Driver views aggregated scan statistics and trends
 */
export const getDriverScanStatistics = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('📊 Getting scan statistics for driver:', user.id, 'Period:', period)

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
    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: {
        and: [
          { driver: { equals: user.id } },
          { scannedAt: { greater_than_equal: startDate.toISOString() } }
        ]
      },
      limit: 1000,
      sort: '-scannedAt'
    })

    // Calculate basic statistics
    const totalScans = scans.docs.length
    const totalEarnings = scans.docs.reduce((sum: number, scan: any) => sum + (scan.earnings || 500), 0)
    const averageEarningsPerScan = totalScans > 0 ? Math.round((totalEarnings / totalScans) * 100) / 100 : 0

    // Calculate daily statistics
    const dailyStatsMap: { [key: string]: { scans: number; earnings: number } } = {}
    
    scans.docs.forEach((scan: any) => {
      const date = new Date(scan.scannedAt || scan.createdAt).toISOString().substring(0, 10)
      if (!dailyStatsMap[date]) {
        dailyStatsMap[date] = { scans: 0, earnings: 0 }
      }
      dailyStatsMap[date].scans++
      dailyStatsMap[date].earnings += (scan.earnings || 500)
    })

    const dailyStats = Object.entries(dailyStatsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        scans: data.scans,
        earnings: data.earnings
      }))

    // Calculate top magazines
    const magazineStatsMap: { [key: string]: { scans: number; earnings: number } } = {}
    
    scans.docs.forEach((scan: any) => {
      const magazineName = scan.magazineName || 'Unknown Magazine'
      if (!magazineStatsMap[magazineName]) {
        magazineStatsMap[magazineName] = { scans: 0, earnings: 0 }
      }
      magazineStatsMap[magazineName].scans++
      magazineStatsMap[magazineName].earnings += (scan.earnings || 500)
    })

    const topMagazines = Object.entries(magazineStatsMap)
      .map(([magazineName, data]) => ({
        magazineName,
        scans: data.scans,
        earnings: data.earnings,
        averagePerScan: Math.round((data.earnings / data.scans) * 100) / 100
      }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10)

    // Calculate trends
    const trends = calculateTrends(dailyStats, period)

    const statistics: ScanStatistics = {
      totalScans,
      totalEarnings,
      averageEarningsPerScan,
      period: getPeriodLabel(period),
      dailyStats,
      topMagazines,
      trends
    }

    console.log('✅ Generated scan statistics for driver:', user.id, 'Total scans:', totalScans)

    return new Response(JSON.stringify({
      success: true,
      statistics,
      chartData: {
        dailyEarnings: dailyStats.map(d => ({ date: d.date, earnings: d.earnings })),
        dailyScans: dailyStats.map(d => ({ date: d.date, scans: d.scans })),
        magazineBreakdown: topMagazines.map(m => ({ name: m.magazineName, earnings: m.earnings }))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get scan statistics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get scan statistics',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function calculateTrends(dailyStats: any[], period: string): any {
  if (dailyStats.length < 2) {
    return {
      weeklyGrowth: 0,
      monthlyGrowth: 0,
      bestDay: 'No data',
      bestMagazine: 'No data'
    }
  }

  // Calculate growth rates
  const firstWeek = dailyStats.slice(0, 7)
  const lastWeek = dailyStats.slice(-7)
  
  const firstWeekEarnings = firstWeek.reduce((sum, d) => sum + d.earnings, 0)
  const lastWeekEarnings = lastWeek.reduce((sum, d) => sum + d.earnings, 0)
  
  const weeklyGrowth = firstWeekEarnings > 0 ? 
    Math.round(((lastWeekEarnings - firstWeekEarnings) / firstWeekEarnings) * 100) : 0

  // Find best day
  const bestDay = dailyStats.reduce((best, current) => 
    current.earnings > best.earnings ? current : best
  )

  return {
    weeklyGrowth,
    monthlyGrowth: weeklyGrowth * 4, // Approximate monthly growth
    bestDay: bestDay.date,
    bestMagazine: 'Calculated from magazine stats'
  }
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

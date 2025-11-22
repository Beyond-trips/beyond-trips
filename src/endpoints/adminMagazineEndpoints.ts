// endpoints/adminMagazineEndpoints.ts

import type { PayloadRequest } from 'payload'
import { sendMagazineNotification } from '../services/notifications/driverNotifications'
import QRCode from 'qrcode'
import { qrCodeStorage } from '../config/cloudStorage'

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

const safeFindMagazinePickupById = async (
  payload: PayloadRequest['payload'],
  id: string,
  depth = 0,
) => {
  try {
    return await payload.findByID({
      collection: 'magazine-pickups',
      id,
      depth,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

const safeFindMagazineEditionById = async (
  payload: PayloadRequest['payload'],
  id: string,
) => {
  try {
    return await payload.findByID({
      collection: 'driver-magazines',
      id,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

const getDriverIdFromPickup = (pickup: any) =>
  typeof pickup?.driver === 'object' ? pickup.driver.id : pickup?.driver

// Helper function to check admin access
const checkAdminAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Only admins can access
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({
      error: 'Access denied - Admin privileges required'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// ===== MAGAZINE PICKUP MANAGEMENT =====

// Get all magazine pickup requests
export const getAllMagazinePickups = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || '' // requested, approved, picked-up, returned

    console.log('📚 Admin getting all magazine pickups, status:', status)

    const whereClause: any = {}
    
    if (status) {
      whereClause.status = { equals: status }
    }

    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: whereClause,
      sort: '-requestedAt',
      page,
      limit,
      depth: 2 // Include driver and magazine details
    })

    return new Response(JSON.stringify({
      success: true,
      pickups: pickups.docs.map((pickup: any) => ({
        id: pickup.id,
        driver: {
          id: typeof pickup.driver === 'object' ? pickup.driver.id : pickup.driver,
          email: typeof pickup.driver === 'object' ? pickup.driver.email : '',
          firstName: typeof pickup.driver === 'object' ? pickup.driver.firstName : '',
          lastName: typeof pickup.driver === 'object' ? pickup.driver.lastName : '',
        },
        magazine: {
          id: typeof pickup.magazine === 'object' ? pickup.magazine.id : pickup.magazine,
          title: typeof pickup.magazine === 'object' ? pickup.magazine.title : '',
          imageUrl: typeof pickup.magazine === 'object' ? pickup.magazine.imageUrl : ''
        },
        quantity: pickup.quantity,
        location: pickup.location,
        pickupDate: pickup.pickupDate,
        returnDate: pickup.returnDate,
        actualReturnDate: pickup.actualReturnDate,
        status: pickup.status,
        qrCode: pickup.qrCode,
        verificationCode: pickup.verificationCode,
        notes: pickup.notes,
        adminNotes: pickup.adminNotes,
        requestedAt: pickup.requestedAt,
        approvedAt: pickup.approvedAt,
        pickedUpAt: pickup.pickedUpAt
      })),
      pagination: {
        page: pickups.page,
        totalPages: pickups.totalPages,
        totalDocs: pickups.totalDocs,
        hasNextPage: pickups.hasNextPage,
        hasPrevPage: pickups.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all magazine pickups error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine pickups'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Approve magazine pickup request
export const approveMagazinePickup = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { pickupId, adminNotes } = body

    if (!pickupId) {
      return new Response(JSON.stringify({
        error: 'Pickup ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Admin approving magazine pickup:', pickupId)

    const pickup = await safeFindMagazinePickupById(req.payload, pickupId, 1)

    if (!pickup) {
      return new Response(JSON.stringify({
        error: 'Pickup request not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((pickup as any).status !== 'requested') {
      return new Response(JSON.stringify({
        error: `Pickup has already been ${(pickup as any).status}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update pickup status to approved
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: 'approved',
        adminNotes: adminNotes || 'Approved by admin',
        approvedAt: new Date().toISOString(),
        approvedBy: user!.id
      }
    })

    console.log('✅ Magazine pickup approved:', pickupId)

    // Send notification to driver
    const driverId = getDriverIdFromPickup(pickup)
    const magazineName = typeof (pickup as any).magazine === 'object' ? (pickup as any).magazine.title : 'Magazine'
    const pickupLocation = (pickup as any).location?.name || (pickup as any).location || 'pickup location'
    
    if (driverId) {
      await sendMagazineNotification(
        req.payload,
        driverId,
        'approved',
        magazineName,
        pickupLocation
      )
    } else {
      console.warn('⚠️ Skipping pickup approval notification, driver missing', pickupId)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine pickup request approved successfully. Driver has been notified.',
      pickup: {
        id: updatedPickup.id,
        status: (updatedPickup as any).status,
        qrCode: (updatedPickup as any).qrCode,
        verificationCode: (updatedPickup as any).verificationCode,
        approvedAt: (updatedPickup as any).approvedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Approve magazine pickup error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve magazine pickup request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Reject magazine pickup request
export const rejectMagazinePickup = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { pickupId, rejectionReason, adminNotes } = body

    if (!pickupId) {
      return new Response(JSON.stringify({
        error: 'Pickup ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!rejectionReason) {
      return new Response(JSON.stringify({
        error: 'Rejection reason is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('❌ Admin rejecting magazine pickup:', pickupId)

    const pickup = await safeFindMagazinePickupById(req.payload, pickupId, 1)

    if (!pickup) {
      return new Response(JSON.stringify({
        error: 'Pickup request not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already processed
    if ((pickup as any).status !== 'requested') {
      return new Response(JSON.stringify({
        error: `Pickup has already been ${(pickup as any).status}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update pickup status to rejected
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: 'rejected',
        rejectionReason,
        adminNotes: adminNotes || rejectionReason
      }
    })

    console.log('❌ Magazine pickup rejected:', pickupId)

    // Send notification to driver
    const driverId = getDriverIdFromPickup(pickup)
    const magazineName = typeof (pickup as any).magazine === 'object' ? (pickup as any).magazine.title : 'Magazine'
    
    if (driverId) {
      await sendMagazineNotification(
        req.payload,
        driverId,
        'rejected',
        magazineName,
        undefined,
        undefined,
        rejectionReason
      )
    } else {
      console.warn('⚠️ Skipping pickup rejection notification, driver missing', pickupId)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine pickup request rejected. Driver has been notified.',
      pickup: {
        id: updatedPickup.id,
        status: (updatedPickup as any).status,
        rejectionReason: (updatedPickup as any).rejectionReason
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Reject magazine pickup error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject magazine pickup request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Mark magazine as picked up
export const markMagazinePickedUp = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { pickupId, verificationCode } = body

    if (!pickupId) {
      return new Response(JSON.stringify({
        error: 'Pickup ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Admin marking magazine as picked up:', pickupId)

    const pickup = await safeFindMagazinePickupById(req.payload, pickupId, 1)

    if (!pickup) {
      return new Response(JSON.stringify({
        error: 'Pickup not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify pickup is approved
    if ((pickup as any).status !== 'approved') {
      return new Response(JSON.stringify({
        error: 'Pickup must be approved before marking as picked up'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify code if provided
    if (verificationCode && (pickup as any).verificationCode !== verificationCode) {
      return new Response(JSON.stringify({
        error: 'Invalid verification code'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update status to picked-up
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickupId,
      data: {
        status: 'picked-up',
        pickedUpAt: new Date().toISOString()
      }
    })

    console.log('✅ Magazine marked as picked up:', pickupId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine marked as picked up successfully',
      pickup: {
        id: updatedPickup.id,
        status: (updatedPickup as any).status,
        pickedUpAt: (updatedPickup as any).pickedUpAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Mark magazine picked up error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark magazine as picked up'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get magazine distribution statistics with enhanced filtering (G10-G12)
export const getMagazineDistributionStats = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const editionId = searchParams.get('editionId') || ''
    const driverId = searchParams.get('driverId') || ''
    const search = searchParams.get('search') || ''
    
    console.log(`📊 Admin getting magazine distribution statistics - Edition: ${editionId}, Driver: ${driverId}`)

    // Build filter criteria
    const whereClause: any = {}
    if (editionId) {
      whereClause.magazine = { equals: editionId }
    }
    if (driverId) {
      whereClause.driver = { equals: driverId }
    }

    // Get all pickups with filters
    const allPickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      limit: 2000, // High limit to get all
      depth: 2 // Populate driver and magazine relationships
    })

    // Get all magazine editions for summary
    const allEditions = await req.payload.find({
      collection: 'driver-magazines',
      limit: 100
    })

    // Calculate total magazines printed across all editions
    const totalPrinted = allEditions.docs.reduce((sum: number, edition: any) => 
      sum + (edition.totalCopiesPrinted || 0), 0)

    // Filter pickups if search term provided
    let filteredPickups = allPickups.docs
    if (search) {
      filteredPickups = allPickups.docs.filter((p: any) => {
        const driver = p.driver
        if (!driver || typeof driver !== 'object') return false
        const driverName = `${driver.firstName || ''} ${driver.lastName || ''}`.toLowerCase()
        const driverEmail = (driver.email || '').toLowerCase()
        return driverName.includes(search.toLowerCase()) || driverEmail.includes(search.toLowerCase())
      })
    }

    const total = filteredPickups.length
    const requested = filteredPickups.filter((p: any) => p.status === 'requested').length
    const approved = filteredPickups.filter((p: any) => p.status === 'approved').length
    const pickedUp = filteredPickups.filter((p: any) => 
      p.status === 'picked-up' || p.status === 'active').length
    const returned = filteredPickups.filter((p: any) => p.status === 'returned').length
    const lost = filteredPickups.filter((p: any) => p.status === 'lost').length
    const damaged = filteredPickups.filter((p: any) => p.status === 'damaged').length
    const rejected = filteredPickups.filter((p: any) => p.status === 'rejected').length

    // Calculate magazine quantities
    const totalPickedQuantity = filteredPickups
      .filter((p: any) => p.status === 'picked-up' || p.status === 'active' || p.status === 'returned')
      .reduce((sum: number, p: any) => sum + (p.quantity || 1), 0)
    
    const returnedQuantity = filteredPickups
      .filter((p: any) => p.status === 'returned')
      .reduce((sum: number, p: any) => sum + (p.quantity || 1), 0)
    
    const unreturnedQuantity = filteredPickups
      .filter((p: any) => p.status === 'picked-up' || p.status === 'active')
      .reduce((sum: number, p: any) => sum + (p.quantity || 1), 0)

    // Summary cards (G10 requirement)
    const summaryCards = {
      printed: totalPrinted,
      picked: totalPickedQuantity,
      returned: returnedQuantity,
      unreturned: unreturnedQuantity,
      returnRate: totalPickedQuantity > 0 ? Math.round((returnedQuantity / totalPickedQuantity) * 100) : 0
    }

    // Get distribution by edition
    const byEdition: any = {}
    filteredPickups.forEach((pickup: any) => {
      const magazine = pickup.magazine
      if (magazine && typeof magazine === 'object') {
        const editionKey = magazine.id
        if (!byEdition[editionKey]) {
          byEdition[editionKey] = {
            editionId: magazine.id,
            editionNumber: magazine.editionNumber || 'N/A',
            title: magazine.title || 'Untitled',
            picked: 0,
            returned: 0,
            unreturned: 0
          }
        }
        const qty = pickup.quantity || 1
        if (pickup.status === 'picked-up' || pickup.status === 'active' || pickup.status === 'returned') {
          byEdition[editionKey].picked += qty
        }
        if (pickup.status === 'returned') {
          byEdition[editionKey].returned += qty
        }
        if (pickup.status === 'picked-up' || pickup.status === 'active') {
          byEdition[editionKey].unreturned += qty
        }
      }
    })

    // Get distribution by driver
    const byDriver: any = {}
    filteredPickups.forEach((pickup: any) => {
      const driver = pickup.driver
      if (driver && typeof driver === 'object') {
        const driverKey = driver.id
        if (!byDriver[driverKey]) {
          byDriver[driverKey] = {
            driverId: driver.id,
            driverName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
            email: driver.email || '',
            picked: 0,
            returned: 0,
            unreturned: 0,
            pickups: []
          }
        }
        const qty = pickup.quantity || 1
        if (pickup.status === 'picked-up' || pickup.status === 'active' || pickup.status === 'returned') {
          byDriver[driverKey].picked += qty
        }
        if (pickup.status === 'returned') {
          byDriver[driverKey].returned += qty
        }
        if (pickup.status === 'picked-up' || pickup.status === 'active') {
          byDriver[driverKey].unreturned += qty
        }
        byDriver[driverKey].pickups.push({
          pickupId: pickup.id,
          magazine: typeof pickup.magazine === 'object' ? pickup.magazine.title : 'Unknown',
          quantity: qty,
          status: pickup.status,
          pickedUpAt: pickup.approvedAt || pickup.createdAt,
          returnedAt: pickup.returnedAt
        })
      }
    })

    // Get recent pickups (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentPickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: {
        createdAt: {
          greater_than: thirtyDaysAgo.toISOString()
        },
        ...whereClause
      },
      limit: 1000
    })

    return new Response(JSON.stringify({
      success: true,
      filters: {
        editionId: editionId || null,
        driverId: driverId || null,
        search: search || null
      },
      summaryCards, // G10: Summary cards
      stats: {
        total,
        totalMagazines: total,
        totalPickups: totalPickedQuantity,
        byStatus: {
          requested,
          approved,
          pickedUp,
          returned,
          lost,
          damaged,
          rejected
        },
        distribution: {
          totalDistributed: totalPickedQuantity,
          inCirculation: unreturnedQuantity,
          totalReturned: returnedQuantity,
          totalLost: lost,
          totalDamaged: damaged,
          returnRate: summaryCards.returnRate
        },
        recent30Days: recentPickups.totalDocs
      },
      byEdition: Object.values(byEdition), // G11: Filter by edition
      byDriver: Object.values(byDriver), // G12: Filter by driver
      availableEditions: allEditions.docs.map((e: any) => ({
        id: e.id,
        title: e.title,
        editionNumber: e.editionNumber,
        isActive: e.isActive
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get magazine distribution stats error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine distribution statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get magazine tracking history
export const getMagazineTrackingHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const magazineId = searchParams.get('magazineId') || ''
    const driverId = searchParams.get('driverId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    console.log('📊 Admin getting magazine tracking history')

    const whereClause: any = {}
    
    if (magazineId) {
      whereClause.magazine = { equals: magazineId }
    }
    
    if (driverId) {
      whereClause.driver = { equals: driverId }
    }
    
    if (startDate && endDate) {
      whereClause.requestedAt = {
        greater_than_equal: startDate,
        less_than_equal: endDate
      }
    }

    const trackingHistory = await req.payload.find({
      collection: 'magazine-pickups',
      where: whereClause,
      sort: '-requestedAt',
      limit: 500,
      depth: 2
    })

    return new Response(JSON.stringify({
      success: true,
      history: trackingHistory.docs.map((pickup: any) => ({
        id: pickup.id,
        driver: {
          id: typeof pickup.driver === 'object' ? pickup.driver.id : pickup.driver,
          name: typeof pickup.driver === 'object' ? `${pickup.driver.firstName} ${pickup.driver.lastName}` : '',
          email: typeof pickup.driver === 'object' ? pickup.driver.email : ''
        },
        magazine: {
          id: typeof pickup.magazine === 'object' ? pickup.magazine.id : pickup.magazine,
          title: typeof pickup.magazine === 'object' ? pickup.magazine.title : ''
        },
        quantity: pickup.quantity,
        location: pickup.location.name,
        status: pickup.status,
        requestedAt: pickup.requestedAt,
        approvedAt: pickup.approvedAt,
        pickedUpAt: pickup.pickedUpAt,
        returnDate: pickup.returnDate,
        actualReturnDate: pickup.actualReturnDate
      })),
      total: trackingHistory.totalDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get magazine tracking history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine tracking history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update pickup status (for manual status changes)
export const updatePickupStatus = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { pickupId, status, adminNotes } = body

    if (!pickupId || !status) {
      return new Response(JSON.stringify({
        error: 'Pickup ID and status are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const validStatuses = ['requested', 'approved', 'rejected', 'picked-up', 'returned', 'lost', 'damaged']
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Admin updating pickup status:', pickupId, 'to', status)

    // Update the pickup
    let updatedPickup: any = null
    try {
      updatedPickup = await req.payload.update({
        collection: 'magazine-pickups',
        id: pickupId,
        data: {
          status,
          adminNotes: adminNotes || `Status changed to ${status} by admin`
        }
      })
    } catch (e) {
      updatedPickup = null
    }

    if (!updatedPickup) {
      return new Response(JSON.stringify({
        error: 'Pickup not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Pickup status updated to ${status}`,
      pickup: {
        id: updatedPickup.id,
        status: (updatedPickup as any).status
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update pickup status error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update pickup status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== MAGAZINE EDITION MANAGEMENT =====

// Get all magazine editions
export const getAllMagazineEditions = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const isPublished = searchParams.get('isPublished') || ''

    console.log('📚 Admin getting all magazine editions')

    const whereClause: any = {}
    if (isPublished) {
      whereClause.isPublished = { equals: isPublished === 'true' }
    }

    const magazines = await req.payload.find({
      collection: 'driver-magazines',
      where: whereClause,
      sort: '-publishedAt',
      page,
      limit
    })

    return new Response(JSON.stringify({
      success: true,
      editions: magazines.docs.map((mag: any) => ({
        id: mag.id,
        title: mag.title,
        description: mag.description,
        imageUrl: mag.imageUrl,
        readTime: mag.readTime,
        category: mag.category,
        isPublished: mag.isPublished,
        publishedAt: mag.publishedAt,
        tags: mag.tags,
        barcode: mag.barcode,
        createdAt: mag.createdAt,
        updatedAt: mag.updatedAt
      })),
      pagination: {
        page: magazines.page,
        totalPages: magazines.totalPages,
        totalDocs: magazines.totalDocs,
        hasNextPage: magazines.hasNextPage,
        hasPrevPage: magazines.hasPrevPage
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all magazine editions error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine editions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Generate unique barcode for magazine
 * Format: MAG-{editionNumber}-{year}-{random}
 * @param editionNumber - Magazine edition number
 * @returns Unique barcode string
 */
function generateMagazineBarcode(editionNumber: number): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `MAG-${editionNumber.toString().padStart(3, '0')}-${year}-${random}`
}

/**
 * Generate barcode image and upload to S3
 * @param barcode - Barcode value to encode in QR code
 * @returns Object with S3 URL and base64 (for backward compatibility)
 */
async function generateBarcodeImage(barcode: string): Promise<{ url: string, base64: string }> {
  try {
    const qrBuffer = await QRCode.toBuffer(barcode, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 500,
      margin: 2,
    })
    
    // Upload to S3
    const uploadResult = await qrCodeStorage.uploadFile(
      qrBuffer,
      `barcode-${barcode}.png`,
      'image/png',
      'magazine-barcodes'
    )
    
    console.log(`✅ Barcode image uploaded to S3: ${uploadResult.url}`)
    
    // Return S3 URL and base64 (for backward compatibility during migration)
    return {
      url: uploadResult.url,
      base64: `data:image/png;base64,${qrBuffer.toString('base64')}`
    }
  } catch (error) {
    console.error('❌ Error generating barcode image:', error)
    throw new Error('Failed to generate barcode image')
  }
}

/**
 * Get next edition number for auto-generation
 * If editionNumber provided in request, use it; otherwise find highest + 1
 * @param payload - Payload instance
 * @param providedEditionNumber - Edition number from request (optional)
 * @returns Next edition number to use
 */
async function getNextEditionNumber(
  payload: any,
  providedEditionNumber?: number
): Promise<number> {
  // If provided, use it
  if (providedEditionNumber !== undefined && providedEditionNumber !== null) {
    return providedEditionNumber
  }

  // Otherwise, find highest edition number and add 1
  try {
    const existingMagazines = await payload.find({
      collection: 'driver-magazines',
      sort: '-editionNumber',
      limit: 1
    })

    const highestEdition = existingMagazines.docs[0]?.editionNumber || 0
    return highestEdition + 1
  } catch (error) {
    console.error('⚠️ Error getting next edition number, defaulting to 1:', error)
    return 1
  }
}

/**
 * Auto-link unlinked magazine campaigns to a new magazine edition
 * Uses timestamp logic: only links campaigns approved/updated after the last printed magazine
 * @param payload - Payload instance
 * @param newMagazineId - ID of the newly created magazine
 * @returns Number of campaigns successfully linked
 */
async function autoLinkMagazineCampaigns(
  payload: any,
  newMagazineId: string
): Promise<number> {
  try {
    console.log(`📋 Starting auto-link process for magazine ${newMagazineId}`)
    
    // Find the last printed magazine (excluding the new one)
    const lastPrintedMagazine = await payload.find({
      collection: 'driver-magazines',
      where: {
        and: [
          { isPrinted: { equals: true } },
          { id: { not_equals: newMagazineId } }
        ]
      },
      sort: '-printedAt',
      limit: 1
    })

    const lastPrintedTimestamp = lastPrintedMagazine.docs[0]?.printedAt

    console.log(`📅 Last printed magazine timestamp: ${lastPrintedTimestamp || 'none (first magazine)'}`)

    // Build where clause for eligible campaigns
    const whereConditions: any[] = [
      { campaignType: { equals: 'magazine' } },
      { status: { in: ['pending_review', 'approved', 'active'] } },
      {
        or: [
          { magazine: { exists: false } },
          { magazine: { equals: null } }
        ]
      }
    ]

    // If previous printed magazine exists, only link campaigns approved/updated after it
    if (lastPrintedTimestamp) {
      whereConditions.push({
        or: [
          { reviewedAt: { greater_than: lastPrintedTimestamp } },
          { updatedAt: { greater_than: lastPrintedTimestamp } },
          { reviewedAt: { exists: false } } // Never reviewed, use updatedAt
        ]
      })
    }

    // Find eligible campaigns
    const eligibleCampaigns = await payload.find({
      collection: 'ad-campaigns',
      where: { and: whereConditions },
      limit: 100
    })

    console.log(`📋 Found ${eligibleCampaigns.docs.length} eligible campaigns for auto-linking`)

    // Link each campaign to the new magazine
    let linkedCount = 0
    for (const campaign of eligibleCampaigns.docs) {
      try {
        // Safety check: verify campaign is still unlinked
        const currentCampaign = await payload.findByID({
          collection: 'ad-campaigns',
          id: campaign.id
        })

        if (!(currentCampaign as any).magazine) {
          await payload.update({
            collection: 'ad-campaigns',
            id: campaign.id,
            data: {
              magazine: newMagazineId
            }
          })
          linkedCount++
          console.log(`✅ Linked campaign "${campaign.campaignName}" (ID: ${campaign.id}) to new magazine`)
        } else {
          console.log(`⏭️  Skipped campaign "${campaign.campaignName}" (already linked to magazine ${(currentCampaign as any).magazine})`)
        }
      } catch (error) {
        console.error(`❌ Failed to link campaign ${campaign.id}:`, error)
      }
    }

    console.log(`🎉 Auto-linking complete: ${linkedCount} campaigns linked to magazine ${newMagazineId}`)
    return linkedCount
  } catch (error) {
    console.error('⚠️ Error auto-linking campaigns (non-critical):', error)
    return 0
  }
}

// Create magazine edition
export const createMagazineEdition = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { title, description, imageUrl, readTime, category, tags, isPublished, barcode, serialNumber, editionNumber } = body

    if (!title || !description) {
      return new Response(JSON.stringify({
        error: 'Title and description are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get edition number (use provided or auto-generate)
    const finalEditionNumber = await getNextEditionNumber(req.payload, editionNumber)

    // Generate barcode if not provided
    let finalBarcode = barcode
    let barcodeImage: string | null = null
    let qrImageUrl: string | null = null

    if (!finalBarcode) {
      // Auto-generate barcode using edition number
      finalBarcode = generateMagazineBarcode(finalEditionNumber)
      console.log(`🔖 Auto-generated barcode: ${finalBarcode}`)
    }

    // Generate barcode image (always, whether barcode provided or auto-generated)
    try {
      const barcodeImageResult = await generateBarcodeImage(finalBarcode)
      qrImageUrl = barcodeImageResult.url // S3 URL
      barcodeImage = barcodeImageResult.base64 // Base64 for backward compatibility
      console.log(`✅ Generated barcode image for: ${finalBarcode} (S3: ${qrImageUrl})`)
    } catch (error) {
      console.error('⚠️ Failed to generate barcode image (non-critical):', error)
      // Continue without image - barcode still works for activation
    }

    // ✅ Barcode Checkpoint: Validate barcode uniqueness
    if (finalBarcode) {
      if (typeof finalBarcode !== 'string' || finalBarcode.trim().length === 0) {
        return new Response(JSON.stringify({
          error: 'Barcode must be a non-empty string'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Check if barcode already exists (uniqueness)
      try {
        const existingBarcode = await req.payload.find({
          collection: 'driver-magazines',
          where: { barcode: { equals: finalBarcode } },
          limit: 1
        })
        if (existingBarcode.docs.length > 0) {
          return new Response(JSON.stringify({
            error: 'Barcode already exists - must be unique'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      } catch (error) {
        console.error('⚠️ Error checking barcode uniqueness:', error)
        // Continue even if check fails
      }
    }

    console.log('📚 Creating magazine edition:', title, 'with barcode:', finalBarcode)

    // Create magazine
    const magazine = await req.payload.create({
      collection: 'driver-magazines',
      data: {
        title,
        description,
        imageUrl: imageUrl || '',
        readTime: readTime || 0,
        category: category || 'general',
        tags: tags || [],
        isPublished: isPublished !== undefined ? isPublished : false,
        publishedAt: isPublished ? new Date().toISOString() : null,
        editionNumber: finalEditionNumber,
        barcode: finalBarcode,
        qrImageUrl: qrImageUrl || undefined, // S3 URL (primary)
        barcodeImage: barcodeImage || undefined, // Base64 (backward compatibility)
        serialNumber: serialNumber || undefined,
        scansCount: 0,
        isPrinted: false, // New magazines are not printed by default
        printedAt: null
      } as any
    })

    // Auto-link magazine campaigns to this newly created magazine
    const linkedCount = await autoLinkMagazineCampaigns(req.payload, (magazine as any).id)

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine edition created successfully',
      edition: {
        id: (magazine as any).id,
        title: (magazine as any).title,
        editionNumber: (magazine as any).editionNumber,
        barcode: (magazine as any).barcode || null,
        qrImageUrl: (magazine as any).qrImageUrl || null, // S3 URL (preferred)
        barcodeImage: (magazine as any).barcodeImage || null, // Base64 (fallback)
        serialNumber: (magazine as any).serialNumber || null,
        isPublished: (magazine as any).isPublished,
        linkedCampaigns: linkedCount
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create magazine edition error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create magazine edition',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update magazine edition
export const updateMagazineEdition = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { magazineId, editionId, title, description, imageUrl, readTime, category, tags, isPublished, barcode, serialNumber } = body
    const id = magazineId || editionId

    if (!id) {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Updating magazine edition:', id, 'with barcode:', barcode || 'no change')

    const existingMagazine = await safeFindMagazineEditionById(req.payload, id)
    if (!existingMagazine) {
      return new Response(JSON.stringify({
        error: 'Magazine edition not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ✅ Barcode Checkpoint: Validate barcode if provided
    if (barcode) {
      if (typeof barcode !== 'string' || barcode.trim().length === 0) {
        return new Response(JSON.stringify({
          error: 'Barcode must be a non-empty string'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Check if barcode already exists on different magazine
      try {
        const existingBarcode = await req.payload.find({
          collection: 'driver-magazines',
          where: { barcode: { equals: barcode } },
          limit: 1
        })
        if (existingBarcode.docs.length > 0 && (existingBarcode.docs[0] as any).id !== id) {
          return new Response(JSON.stringify({
            error: 'Barcode already exists on another magazine - must be unique'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      } catch (error) {
        console.error('⚠️ Error checking barcode uniqueness:', error)
        // Continue even if check fails
      }
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (title) updateData.title = title
    if (description) updateData.description = description
    if (imageUrl) updateData.imageUrl = imageUrl
    if (readTime !== undefined) updateData.readTime = readTime
    if (category) updateData.category = category
    if (tags) updateData.tags = tags
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished
      if (isPublished && !updateData.publishedAt) {
        updateData.publishedAt = new Date().toISOString()
      }
    }
    if (barcode !== undefined) updateData.barcode = barcode || undefined
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber || undefined

    // Update magazine
    const updatedMagazine = await req.payload.update({
      collection: 'driver-magazines',
      id: id,
      data: updateData
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine edition updated successfully',
      edition: {
        id: (updatedMagazine as any).id,
        title: (updatedMagazine as any).title,
        isPublished: (updatedMagazine as any).isPublished
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update magazine edition error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update magazine edition'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete magazine edition
export const deleteMagazineEdition = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { magazineId, editionId } = body
    const id = magazineId || editionId

    if (!id) {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Deleting magazine edition:', id)

    const magazine = await safeFindMagazineEditionById(req.payload, id)
    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine edition not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if magazine has any pickups
    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: { magazine: { equals: id } },
      limit: 1
    })

    if (pickups.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'Cannot delete magazine with existing pickup records. Archive it instead.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete magazine
    await req.payload.delete({
      collection: 'driver-magazines',
      id: id
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine edition deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete magazine edition error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete magazine edition'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Set active magazine edition (only one can be active at a time)
export const setActiveEdition = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    // Get magazine ID from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const magazineIdIndex = pathParts.indexOf('magazines') + 1
    const magazineId = pathParts[magazineIdIndex]

    if (!magazineId || magazineId === 'set-active') {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Setting active magazine edition:', magazineId)

    const magazine = await safeFindMagazineEditionById(req.payload, magazineId)

    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine edition not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update this magazine to active
    // The collection hook will automatically deactivate all others
    const updatedMagazine = await req.payload.update({
      collection: 'driver-magazines',
      id: magazineId,
      data: {
        isActive: true,
        status: 'active',
        isPublished: true // Auto-publish when setting active
      }
    })

    // Notify all active drivers about new active magazine edition
    try {
      // Get all active drivers
      const drivers = await req.payload.find({
        collection: 'users',
        where: { role: { equals: 'driver' } },
        limit: 1000 // Batch notifications
      })

      const magazineName = (updatedMagazine as any).title || (updatedMagazine as any).name || 'Magazine'
      
      // Get first pickup location if available
      const pickupLocations = await req.payload.find({
        collection: 'magazine-pickup-locations',
        where: { magazineId: { equals: magazineId } },
        limit: 1
      })
      
      const pickupLocation = pickupLocations.docs.length > 0 
        ? (pickupLocations.docs[0] as any).locationName 
        : 'Available locations'

      // Send notification to each driver
      let notificationsSent = 0
      for (const driver of drivers.docs) {
        try {
          await sendMagazineNotification(
            req.payload,
            driver.id,
            'availability',
            magazineName,
            pickupLocation
          )
          notificationsSent++
        } catch (notifError) {
          console.warn(`⚠️ Failed to send magazine notification to driver ${driver.id}:`, notifError)
        }
      }
      
      console.log(`✅ Sent magazine availability notifications to ${notificationsSent} drivers`)
    } catch (notifError) {
      console.error('⚠️ Failed to send magazine availability notifications:', notifError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine edition set as active successfully',
      magazine: updatedMagazine
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Set active edition error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to set active edition',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


// Get detailed driver metrics for admin tracking (B9)
export const getDriverMetricsForAdmin = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const driverId = searchParams.get('driverId') || ''
    
    if (!driverId) {
      return new Response(JSON.stringify({
        error: 'Driver ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Admin fetching detailed metrics for driver: ${driverId}`)

    // Get driver details
    const driver = await req.payload.findByID({
      collection: 'users',
      id: driverId
    })

    if (!driver) {
      return new Response(JSON.stringify({
        error: 'Driver not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get driver earnings
    const earnings = await req.payload.find({
      collection: 'driver-earnings',
      where: { driver: { equals: driverId } },
      limit: 1000
    })

    const totalEarnings = earnings.docs.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const totalScans = earnings.docs.reduce((sum: number, e: any) => sum + (e.numberOfScans || 0), 0)

    // Get driver scans
    const scans = await req.payload.find({
      collection: 'driver-scans',
      where: { driver: { equals: driverId } },
      limit: 1000,
      sort: '-createdAt'
    })

    // Get magazine pickups
    const magazinePickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: { driver: { equals: driverId } },
      limit: 100,
      depth: 1
    })

    const totalMagazinesCollected = magazinePickups.docs.reduce((sum: number, p: any) => 
      sum + (p.quantity || 1), 0)
    
    const activeMagazines = magazinePickups.docs.filter((p: any) => 
      p.status === 'picked-up' || p.status === 'active').length

    // Get driver's points (calculate from scans)
    const totalPoints = scans.docs.reduce((sum: number, s: any) => sum + (s.pointsEarned || 0), 0)

    // Get driver withdrawals
    const withdrawals = await req.payload.find({
      collection: 'driver-withdrawals',
      where: { driver: { equals: driverId } },
      limit: 100
    })

    const pendingWithdrawals = withdrawals.docs.filter((w: any) => w.status === 'pending').length
    const approvedWithdrawals = withdrawals.docs.filter((w: any) => w.status === 'approved').length
    const completedWithdrawals = withdrawals.docs.filter((w: any) => w.status === 'completed').length

    // Calculate earnings by month (last 6 months)
    const monthlyEarnings: any = {}
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    earnings.docs.forEach((earning: any) => {
      const earnedDate = new Date(earning.createdAt)
      if (earnedDate >= sixMonthsAgo) {
        const monthKey = `${earnedDate.getFullYear()}-${String(earnedDate.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyEarnings[monthKey]) {
          monthlyEarnings[monthKey] = { amount: 0, scans: 0 }
        }
        monthlyEarnings[monthKey].amount += earning.amount || 0
        monthlyEarnings[monthKey].scans += earning.numberOfScans || 0
      }
    })

    // Recent activity
    const recentScans = scans.docs.slice(0, 10).map((s: any) => ({
      scanId: s.id,
      scannedAt: s.createdAt,
      pointsEarned: s.pointsEarned,
      location: s.location || 'Unknown'
    }))

    return new Response(JSON.stringify({
      success: true,
      driver: {
        id: driver.id,
        name: `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim(),
        email: (driver as any).email,
        status: (driver as any).status,
        rating: (driver as any).rating || 0
      },
      metrics: {
        earnings: {
          total: totalEarnings,
          available: (driver as any).availableBalance || 0,
          pending: (driver as any).pendingBalance || 0
        },
        scans: {
          total: totalScans,
          recentCount: scans.totalDocs
        },
        points: {
          total: totalPoints
        },
        magazines: {
          totalCollected: totalMagazinesCollected,
          active: activeMagazines,
          pickups: magazinePickups.docs.map((p: any) => ({
            pickupId: p.id,
            magazine: typeof p.magazine === 'object' ? p.magazine.title : 'Unknown',
            quantity: p.quantity || 1,
            status: p.status,
            pickedUpAt: p.approvedAt || p.createdAt,
            returnedAt: p.returnedAt
          }))
        },
        withdrawals: {
          pending: pendingWithdrawals,
          approved: approvedWithdrawals,
          completed: completedWithdrawals,
          total: withdrawals.totalDocs
        }
      },
      monthlyEarnings: Object.entries(monthlyEarnings).map(([month, data]: [string, any]) => ({
        month,
        amount: data.amount,
        scans: data.scans
      })).sort((a, b) => a.month.localeCompare(b.month)),
      recentActivity: {
        scans: recentScans
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get driver metrics error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get driver metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== MAGAZINE RETURN VERIFICATION (R13-R17) =====

/**
 * Verify magazine return via barcode scan (R13)
 * Admin/Operator scans the magazine barcode at pickup point to verify return
 */
export const verifyMagazineReturnByBarcode = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { barcode, returnLocationId, condition, notes } = body

    if (!barcode) {
      return new Response(JSON.stringify({
        error: 'Barcode is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Admin verifying magazine return via barcode:', barcode)

    // Find the magazine edition by barcode
    const magazines = await req.payload.find({
      collection: 'driver-magazines',
      where: { barcode: { equals: barcode } },
      limit: 1
    })

    if (magazines.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid barcode',
        message: 'Magazine not found with this barcode'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const magazine = magazines.docs[0] as any

    // Find the pickup record with this barcode
    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: {
        and: [
          { magazine: { equals: magazine.id } },
          { activationBarcode: { equals: barcode } },
          { status: { in: ['active', 'picked-up'] } }
        ]
      },
      limit: 1
    })

    if (pickups.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Magazine not found',
        message: 'No active pickup found for this barcode'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const pickup = pickups.docs[0] as any
    const driverId = typeof pickup.driver === 'object' ? pickup.driver.id : pickup.driver

    // Verify the magazine belongs to an active driver
    const driver = await req.payload.findByID({
      collection: 'users',
      id: driverId
    })

    if (!driver || (driver as any).role !== 'driver') {
      return new Response(JSON.stringify({
        error: 'Driver not found or inactive'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already returned
    if (pickup.status === 'returned') {
      return new Response(JSON.stringify({
        error: 'Already returned',
        message: 'This magazine has already been marked as returned'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update pickup status to returned (R15)
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickup.id,
      data: {
        status: 'returned',
        returnedAt: new Date().toISOString(),
        actualReturnDate: new Date().toISOString(),
        returnLocation: returnLocationId || pickup.pickupLocation,
        returnCondition: condition || 'good',
        returnNotes: notes || '',
        returnVerifiedBy: user?.id,
        returnVerificationMethod: 'barcode_scan'
      }
    })

    console.log('✅ Magazine return verified via barcode:', pickup.id)

    // Send notification to driver (R16)
    try {
      await req.payload.create({
        collection: 'driver-notifications',
        data: {
          driver: driverId,
          type: 'magazine',
          title: 'Magazine Return Confirmed',
          message: 'Magazine successfully returned and verified. You can now pick up the latest edition.',
          isRead: false,
          priority: 'medium'
        }
      })
    } catch (error) {
      console.error('⚠️ Failed to send driver notification:', error)
    }

    // Return success message
    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine return verified successfully',
      return: {
        id: updatedPickup.id,
        magazineTitle: magazine.title,
        driverName: `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim(),
        returnedAt: (updatedPickup as any).returnedAt,
        condition: (updatedPickup as any).returnCondition,
        verificationMethod: 'barcode_scan'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Verify magazine return error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to verify magazine return',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Manually verify magazine return (R14)
 * Fallback when barcode is damaged or unreadable
 */
export const verifyMagazineReturnManually = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { driverId, magazineId, returnLocationId, condition, notes } = body

    if (!driverId || !magazineId) {
      return new Response(JSON.stringify({
        error: 'Driver ID and Magazine ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📚 Admin manually verifying magazine return - Driver:', driverId, 'Magazine:', magazineId)

    // Verify driver exists and is active
    const driver = await req.payload.findByID({
      collection: 'users',
      id: driverId
    })

    if (!driver || (driver as any).role !== 'driver') {
      return new Response(JSON.stringify({
        error: 'Driver not found or invalid'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify magazine exists
    const magazine = await req.payload.findByID({
      collection: 'driver-magazines',
      id: magazineId
    })

    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Find the active pickup for this driver and magazine
    const pickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: {
        and: [
          { driver: { equals: driverId } },
          { magazine: { equals: magazineId } },
          { status: { in: ['active', 'picked-up'] } }
        ]
      },
      limit: 1
    })

    if (pickups.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'No active pickup found',
        message: 'This driver does not have an active pickup for this magazine'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const pickup = pickups.docs[0] as any

    // Check if already returned
    if (pickup.status === 'returned') {
      return new Response(JSON.stringify({
        error: 'Already returned',
        message: 'This magazine has already been marked as returned'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update pickup status to returned
    const updatedPickup = await req.payload.update({
      collection: 'magazine-pickups',
      id: pickup.id,
      data: {
        status: 'returned',
        returnedAt: new Date().toISOString(),
        actualReturnDate: new Date().toISOString(),
        returnLocation: returnLocationId || pickup.pickupLocation,
        returnCondition: condition || 'good',
        returnNotes: notes || '',
        returnVerifiedBy: user?.id,
        returnVerificationMethod: 'manual_entry'
      }
    })

    console.log('✅ Magazine return verified manually:', pickup.id)

    // Send notification to driver
    try {
      await req.payload.create({
        collection: 'driver-notifications',
        data: {
          driver: driverId,
          type: 'magazine',
          title: 'Magazine Return Confirmed',
          message: 'Magazine successfully returned and verified. You can now pick up the latest edition.',
          isRead: false,
          priority: 'medium'
        }
      })
    } catch (error) {
      console.error('⚠️ Failed to send driver notification:', error)
    }

    // Return success message
    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine return verified successfully (manual entry)',
      return: {
        id: updatedPickup.id,
        magazineTitle: (magazine as any).title,
        driverName: `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim(),
        returnedAt: (updatedPickup as any).returnedAt,
        condition: (updatedPickup as any).returnCondition,
        verificationMethod: 'manual_entry'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Manually verify magazine return error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to verify magazine return',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Mark a magazine edition as printed
 * Once printed, the magazine will no longer accept new campaign links
 */
export const markMagazineAsPrinted = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check admin access
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { magazineId } = body

    if (!magazineId) {
      return new Response(JSON.stringify({
        error: 'Magazine ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🖨️  Marking magazine ${magazineId} as printed`)

    // Verify magazine exists
    const magazine = await req.payload.findByID({
      collection: 'driver-magazines',
      id: magazineId
    })

    if (!magazine) {
      return new Response(JSON.stringify({
        error: 'Magazine not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already printed
    if ((magazine as any).isPrinted) {
      return new Response(JSON.stringify({
        error: 'Magazine is already marked as printed',
        printedAt: (magazine as any).printedAt
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Count linked campaigns
    const linkedCampaigns = await req.payload.find({
      collection: 'ad-campaigns',
      where: {
        and: [
          { magazine: { equals: magazineId } },
          { campaignType: { equals: 'magazine' } }
        ]
      },
      limit: 100
    })

    // Mark magazine as printed
    const updatedMagazine = await req.payload.update({
      collection: 'driver-magazines',
      id: magazineId,
      data: {
        isPrinted: true,
        printedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Magazine "${(magazine as any).title}" marked as printed with ${linkedCampaigns.docs.length} linked campaigns`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Magazine marked as printed successfully',
      magazine: {
        id: (updatedMagazine as any).id,
        title: (updatedMagazine as any).title,
        isPrinted: (updatedMagazine as any).isPrinted,
        printedAt: (updatedMagazine as any).printedAt,
        linkedCampaigns: linkedCampaigns.docs.length
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Mark magazine as printed error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark magazine as printed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

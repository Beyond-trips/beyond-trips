// endpoints/adminPickupLocationsEndpoints.ts
// Admin endpoints for managing magazine pickup locations

import type { PayloadRequest } from 'payload'
import { sendMagazineNotification } from '../services/notifications/driverNotifications'

// Helper function to check admin access
const checkAdminAccess = (user: any): boolean => {
  return user && (user.role === 'admin' || user.role === 'super-admin')
}

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
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// ===== PICKUP LOCATIONS MANAGEMENT =====

/**
 * Get all pickup locations
 * GET /api/admin/magazine-locations
 */
export const getAllPickupLocations = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get URL parameters for filtering
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const city = url.searchParams.get('city')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    // Build query
    const where: any = {}
    if (status) {
      where.status = { equals: status }
    }
    if (city) {
      where.city = { contains: city }
    }

    console.log('📍 Admin fetching pickup locations')

    const locations = await req.payload.find({
      collection: 'magazine-pickup-locations',
      where,
      limit,
      page,
      sort: '-createdAt'
    })

    return new Response(JSON.stringify({
      success: true,
      locations: locations.docs,
      pagination: {
        page: locations.page,
        limit: locations.limit,
        totalPages: locations.totalPages,
        totalDocs: locations.totalDocs,
        hasNextPage: locations.hasNextPage,
        hasPrevPage: locations.hasPrevPage
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error fetching pickup locations:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch pickup locations',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get single pickup location by ID
 * GET /api/admin/magazine-locations/:id
 */
export const getPickupLocationById = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get location ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const locationIdIndex = pathParts.indexOf('magazine-locations') + 1
    const locationId = pathParts[locationIdIndex]

    if (!locationId) {
      return new Response(JSON.stringify({
        error: 'Location ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const location = await req.payload.findByID({
      collection: 'magazine-pickup-locations',
      id: locationId
    })

    return new Response(JSON.stringify({
      success: true,
      location
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error fetching pickup location:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch pickup location',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Create new pickup location
 * POST /api/admin/magazine-locations
 */
export const createPickupLocation = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)

    // Validate required fields
    if (!body.name || !body.address || !body.contactPerson || !body.contactPhone) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['name', 'address', 'contactPerson', 'contactPhone']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📍 Admin creating new pickup location:', body.name)

    const location = await req.payload.create({
      collection: 'magazine-pickup-locations',
      data: body
    })

    // Notify all active drivers about new pickup location
    try {
      const drivers = await req.payload.find({
        collection: 'users',
        where: { role: { equals: 'driver' } },
        limit: 1000
      })

      const locationName = (location as any).locationName || (location as any).address || 'New Location'
      
      let notificationsSent = 0
      for (const driver of drivers.docs) {
        try {
          await sendMagazineNotification(
            req.payload,
            driver.id,
            'availability',
            'Magazine',
            locationName
          )
          notificationsSent++
        } catch (notifError) {
          console.warn(`⚠️ Failed to send pickup location notification to driver ${driver.id}:`, notifError)
        }
      }
      
      console.log(`✅ Sent pickup location notifications to ${notificationsSent} drivers`)
    } catch (notifError) {
      console.error('⚠️ Failed to send pickup location notifications:', notifError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Pickup location created successfully',
      location
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error creating pickup location:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create pickup location',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Update pickup location
 * PUT /api/admin/magazine-locations/:id
 */
export const updatePickupLocation = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get location ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const locationIdIndex = pathParts.indexOf('magazine-locations') + 1
    const locationId = pathParts[locationIdIndex]

    if (!locationId) {
      return new Response(JSON.stringify({
        error: 'Location ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)

    console.log('📍 Admin updating pickup location:', locationId)

    const location = await req.payload.update({
      collection: 'magazine-pickup-locations',
      id: locationId,
      data: body
    })

    // Notify drivers if location details changed significantly
    // Only notify for major changes (address, hours, status)
    if (body.address || body.operatingHours || body.status === 'closed') {
      try {
        const drivers = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'driver' } },
          limit: 1000
        })

        const locationName = (location as any).locationName || (location as any).address || 'Location'
        
        let notificationsSent = 0
        for (const driver of drivers.docs) {
          try {
            await sendMagazineNotification(
              req.payload,
              driver.id,
              'availability',
              'Magazine',
              locationName
            )
            notificationsSent++
          } catch (notifError) {
            console.warn(`⚠️ Failed to send location update notification to driver ${driver.id}:`, notifError)
          }
        }
        
        console.log(`✅ Sent location update notifications to ${notificationsSent} drivers`)
      } catch (notifError) {
        console.error('⚠️ Failed to send location update notifications:', notifError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Pickup location updated successfully',
      location
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error updating pickup location:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update pickup location',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Delete pickup location
 * DELETE /api/admin/magazine-locations/:id
 */
export const deletePickupLocation = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get location ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const locationIdIndex = pathParts.indexOf('magazine-locations') + 1
    const locationId = pathParts[locationIdIndex]

    if (!locationId) {
      return new Response(JSON.stringify({
        error: 'Location ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if there are active pickups for this location
    const activePickups = await req.payload.find({
      collection: 'magazine-pickups',
      where: {
        and: [
          { 'location.name': { equals: locationId } },
          { status: { in: ['requested', 'approved', 'picked-up', 'active'] } }
        ]
      },
      limit: 1
    })

    if (activePickups.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'Cannot delete location',
        message: 'This location has active pickup requests. Please complete or cancel them first.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📍 Admin deleting pickup location:', locationId)

    await req.payload.delete({
      collection: 'magazine-pickup-locations',
      id: locationId
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Pickup location deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error deleting pickup location:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete pickup location',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Update stock quantity for a location
 * PATCH /api/admin/magazine-locations/:id/stock
 */
export const updateLocationStock = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    if (!checkAdminAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get location ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const locationIdIndex = pathParts.indexOf('magazine-locations') + 1
    const locationId = pathParts[locationIdIndex]

    if (!locationId) {
      return new Response(JSON.stringify({
        error: 'Location ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await parseRequestBody(req)
    const { availableQuantity, magazineEdition } = body

    if (availableQuantity === undefined) {
      return new Response(JSON.stringify({
        error: 'availableQuantity is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📍 Admin updating stock for location:', locationId, 'to:', availableQuantity)

    const updateData: any = {
      availableQuantity,
      lastStockUpdate: new Date().toISOString()
    }

    if (magazineEdition) {
      updateData.magazineEdition = magazineEdition
    }

    const location = await req.payload.update({
      collection: 'magazine-pickup-locations',
      id: locationId,
      data: updateData
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Stock updated successfully',
      location
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ Error updating location stock:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update stock',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


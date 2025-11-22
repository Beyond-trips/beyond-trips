// endpoints/adminSettingsEndpoints.ts

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

const safeFindSettingById = async (
  payload: PayloadRequest['payload'],
  id: string,
) => {
  try {
    return await payload.findByID({
      collection: 'system-settings',
      id,
    })
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('not found')) {
      return null
    }
    throw error
  }
}

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

// ===== SETTINGS MANAGEMENT =====

// Get all settings (returns a flat array of settings)
export const getAllSettings = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const category = searchParams.get('category') || ''

    console.log('⚙️ Getting all settings, category:', category)

    const whereClause: any = {}
    if (category) {
      whereClause.category = { equals: category }
    }

    const settings = await req.payload.find({
      collection: 'system-settings',
      where: whereClause,
      sort: 'category',
      limit: 100,
    })

    return new Response(JSON.stringify({
      success: true,
      settings: settings.docs.map((setting: any) => ({
        id: setting.id,
        key: setting.key,
        value: setting.value,
        category: setting.category,
        description: setting.description,
        lastUpdatedBy: setting.lastUpdatedBy,
        lastUpdatedAt: setting.lastUpdatedAt,
      })),
      total: settings.totalDocs,
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get all settings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get settings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get single setting by name
export const getSetting = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const name = searchParams.get('name') || ''

    if (!name) {
      return new Response(JSON.stringify({
        error: 'Setting name is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⚙️ Getting setting by name:', name)

    const settings = await req.payload.find({
      collection: 'system-settings',
      where: { key: { equals: name } },
      limit: 1
    })

    if (settings.docs.length === 0) {
      return new Response(JSON.stringify({
        error: 'Setting not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const setting = settings.docs[0]

    return new Response(JSON.stringify({
      success: true,
      setting: {
        id: setting.id,
        key: (setting as any).key,
        value: (setting as any).value,
        category: (setting as any).category,
        description: (setting as any).description,
        lastUpdatedBy: (setting as any).lastUpdatedBy,
        lastUpdatedAt: (setting as any).lastUpdatedAt,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get setting error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get setting'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update setting by ID
export const updateSetting = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { settingId, value } = body

    if (!settingId || value === undefined) {
      return new Response(JSON.stringify({
        error: 'Setting ID and value are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⚙️ Updating setting:', settingId)

    const setting = await safeFindSettingById(req.payload, settingId)

    if (!setting) {
      return new Response(JSON.stringify({
        error: 'Setting not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if setting is editable
    // SystemSettings schema does not include an isEditable flag by default

    // No type coercion here; value is JSON per schema

    // Update the setting
    const updatedSetting = await req.payload.update({
      collection: 'system-settings',
      id: setting.id,
      data: {
        value: value,
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Setting updated successfully',
      setting: {
        id: (updatedSetting as any).id,
        key: (updatedSetting as any).key,
        value: (updatedSetting as any).value,
        lastUpdatedAt: (updatedSetting as any).lastUpdatedAt,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update setting error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update setting'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Create new setting (name + value + category + description)
export const createSetting = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { name, value, category, description } = body

    if (!name || value === undefined || !category) {
      return new Response(JSON.stringify({
        error: 'Name, value, and category are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⚙️ Creating new setting:', name)

    // Check if setting already exists
    const existing = await req.payload.find({
      collection: 'system-settings',
      where: { key: { equals: name } },
      limit: 1
    })

    if (existing.docs.length > 0) {
      return new Response(JSON.stringify({
        error: 'Setting with this name already exists'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create the setting
    const newSetting = await req.payload.create({
      collection: 'system-settings',
      data: {
        key: name,
        value: value,
        category,
        description,
        type: 'string', // Default to 'string' if not provided
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Setting created successfully',
      setting: {
        id: (newSetting as any).id,
        key: (newSetting as any).key,
        value: (newSetting as any).value,
        category: (newSetting as any).category,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Create setting error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create setting'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete setting
export const deleteSetting = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    const { settingId } = body

    if (!settingId) {
      return new Response(JSON.stringify({
        error: 'Setting ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('⚙️ Deleting setting:', settingId)

    const setting = await safeFindSettingById(req.payload, settingId)

    if (!setting) {
      return new Response(JSON.stringify({
        error: 'Setting not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete the setting
    await req.payload.delete({
      collection: 'system-settings',
      id: settingId
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Setting deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete setting error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete setting'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== SYSTEM CONFIGURATION DEFAULTS =====

// Initialize default system settings if they don't exist
export const initializeDefaultSettings = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('🔧 Initializing default system settings')

    const defaultSettings = [
      // Campaign Configuration
      {
        key: 'default_campaign_duration_days',
        value: '30',
        type: 'number',
        category: 'platform',
        description: 'Default duration for new campaigns in days',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'min_campaign_duration_days',
        value: '7',
        type: 'number',
        category: 'platform',
        description: 'Minimum campaign duration in days',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'max_campaign_duration_days',
        value: '365',
        type: 'number',
        category: 'platform',
        description: 'Maximum campaign duration in days',
        isEditable: true,
        isPublic: false
      },
      // Payout Configuration
      {
        key: 'payout_frequency',
        value: 'weekly',
        type: 'string',
        category: 'payments',
        description: 'Frequency of automatic payouts (daily, weekly, monthly)',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'min_payout_amount',
        value: '5000',
        type: 'number',
        category: 'payments',
        description: 'Minimum payout amount in NGN',
        isEditable: true,
        isPublic: true
      },
      {
        key: 'max_payout_amount',
        value: '1000000',
        type: 'number',
        category: 'payments',
        description: 'Maximum payout amount per request in NGN',
        isEditable: true,
        isPublic: true
      },
      {
        key: 'payout_processing_days',
        value: '3',
        type: 'number',
        category: 'payments',
        description: 'Number of business days to process payouts',
        isEditable: true,
        isPublic: true
      },
      // Notification Triggers
      {
        key: 'notify_driver_on_campaign_approval',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Send notification to drivers when a campaign is approved',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'notify_driver_on_payout_approved',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Send notification to drivers when payout is approved',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'notify_driver_on_payout_completed',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Send notification to drivers when payout is completed',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'notify_advertiser_on_campaign_status',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Send notification to advertisers on campaign status changes',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'notify_admin_on_pending_approvals',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Send notification to admin when there are pending approvals',
        isEditable: true,
        isPublic: false
      },
      // System Limits
      {
        key: 'max_magazine_pickup_quantity',
        value: '100',
        type: 'number',
        category: 'system',
        description: 'Maximum magazines a driver can pickup at once',
        isEditable: true,
        isPublic: true
      },
      {
        key: 'max_scan_earnings_per_day',
        value: '50',
        type: 'number',
        category: 'system',
        description: '[DEPRECATED] Maximum number of scans a driver can earn from per day - Scans no longer generate earnings',
        isEditable: false,
        isPublic: false
      },
      {
        key: 'scan_earning_rate',
        value: '50',
        type: 'number',
        category: 'payments',
        description: '[DEPRECATED] Amount earned per magazine scan in NGN - Scans no longer generate earnings. Drivers earn through BTL coins only.',
        isEditable: false,
        isPublic: false
      },
      {
        key: 'duplicate_scan_prevention_hours',
        value: '24',
        type: 'number',
        category: 'system',
        description: 'Hours to prevent duplicate scans from same user',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'max_pending_withdrawals_per_driver',
        value: '3',
        type: 'number',
        category: 'payments',
        description: 'Maximum pending withdrawal requests per driver',
        isEditable: true,
        isPublic: true
      },
      // Feature Flags
      {
        key: 'enable_qr_campaigns',
        value: 'true',
        type: 'boolean',
        category: 'features',
        description: 'Enable QR code engagement campaigns',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'enable_magazine_distribution',
        value: 'true',
        type: 'boolean',
        category: 'features',
        description: 'Enable physical magazine distribution',
        isEditable: true,
        isPublic: false
      },
      {
        key: 'enable_driver_ratings',
        value: 'true',
        type: 'boolean',
        category: 'features',
        description: 'Enable driver rating system',
        isEditable: true,
        isPublic: false
      }
    ]

    const results = {
      created: [] as string[],
      existing: [] as string[],
      failed: [] as Array<{ key: string; error: string }>
    }

    // Create settings that don't exist
    for (const setting of defaultSettings) {
      try {
        // Check if setting already exists
        const existing = await req.payload.find({
          collection: 'system-settings',
          where: { key: { equals: setting.key } },
          limit: 1
        })

        if (existing.docs.length > 0) {
          results.existing.push(setting.key)
          continue
        }

        // Create the setting
        await req.payload.create({
          collection: 'system-settings',
          data: setting
        })

        results.created.push(setting.key)

      } catch (error: any) {
        results.failed.push({ key: setting.key, error: error.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Initialized default settings. Created: ${results.created.length}, Existing: ${results.existing.length}, Failed: ${results.failed.length}`,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Initialize default settings error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to initialize default settings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get system configuration summary (grouped by category)
export const getSystemConfigSummary = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const accessCheck = checkAdminAccess(user)
    if (accessCheck) return accessCheck

    console.log('📊 Getting system configuration summary')

    const allSettings = await req.payload.find({
      collection: 'system-settings',
      limit: 1000,
      sort: 'category'
    })

    // Group settings by category
    const settingsByCategory: any = {}
    allSettings.docs.forEach((setting: any) => {
      const category = setting.category || 'uncategorized'
      if (!settingsByCategory[category]) {
        settingsByCategory[category] = []
      }
      settingsByCategory[category].push({
        id: setting.id,
        key: setting.key,
        value: setting.value,
        type: setting.type,
        description: setting.description,
        isEditable: setting.isEditable,
        isPublic: setting.isPublic,
        lastUpdatedAt: setting.updatedAt
      })
    })

    return new Response(JSON.stringify({
      success: true,
      summary: settingsByCategory,
      totalSettings: allSettings.totalDocs
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get system config summary error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get system configuration summary'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


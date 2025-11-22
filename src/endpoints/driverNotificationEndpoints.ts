import { PayloadRequest } from 'payload'

interface NotificationPreferences {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  payoutAlerts: boolean
  earningsAlerts: boolean
  magazineAlerts: boolean
  profileAlerts: boolean
}

interface NotificationItem {
  id: string
  type: 'payout' | 'earnings' | 'magazine' | 'profile' | 'system'
  title: string
  message: string
  isRead: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  metadata?: {
    payoutId?: string
    earningsAmount?: number
    magazineName?: string
    profileField?: string
  }
}

interface NotificationCenter {
  unreadCount: number
  notifications: NotificationItem[]
  preferences: NotificationPreferences
}

// ===== I1: VIEW PAYOUT NOTIFICATIONS =====

/**
 * I1: View Payout Notifications
 * Driver views notifications related to payout requests and status updates
 */
export const getPayoutNotifications = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('🔔 Getting payout notifications for driver:', user.id)

    // Get payout-related notifications
    const payoutNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'payout' } }
        ]
      },
      sort: '-createdAt',
      limit: 50
    })

    const notifications = payoutNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt,
      metadata: {
        payoutId: notification.payoutId,
        amount: notification.amount,
        status: notification.payoutStatus
      }
    }))

    return new Response(JSON.stringify({
      success: true,
      notifications,
      total: payoutNotifications.totalDocs,
      unreadCount: notifications.filter(n => !n.isRead).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get payout notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get payout notifications',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== I2: VIEW EARNINGS NOTIFICATIONS =====

/**
 * I2: View Earnings Notifications
 * Driver views notifications about earnings updates and new opportunities
 */
export const getEarningsNotifications = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('💰 Getting earnings notifications for driver:', user.id)

    // Get earnings-related notifications
    const earningsNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'earnings' } }
        ]
      },
      sort: '-createdAt',
      limit: 50
    })

    const notifications = earningsNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt,
      metadata: {
        earningsAmount: notification.earningsAmount,
        campaignId: notification.campaignId,
        magazineName: notification.magazineName
      }
    }))

    return new Response(JSON.stringify({
      success: true,
      notifications,
      total: earningsNotifications.totalDocs,
      unreadCount: notifications.filter(n => !n.isRead).length,
      totalEarnings: notifications.reduce((sum, n) => sum + (n.metadata.earningsAmount || 0), 0)
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get earnings notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get earnings notifications',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== I3: VIEW MAGAZINE NOTIFICATIONS =====

/**
 * I3: View Magazine Notifications
 * Driver views notifications about magazine availability, pickup reminders, and return deadlines
 */
export const getMagazineNotifications = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('📰 Getting magazine notifications for driver:', user.id)

    // Get magazine-related notifications
    const magazineNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'magazine' } }
        ]
      },
      sort: '-createdAt',
      limit: 50
    })

    const notifications = magazineNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt,
      metadata: {
        magazineName: notification.magazineName,
        pickupLocation: notification.pickupLocation,
        dueDate: notification.dueDate,
        actionRequired: notification.actionRequired || false
      }
    }))

    return new Response(JSON.stringify({
      success: true,
      notifications,
      total: magazineNotifications.totalDocs,
      unreadCount: notifications.filter(n => !n.isRead).length,
      actionRequired: notifications.filter(n => n.metadata.actionRequired).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get magazine notifications error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get magazine notifications',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== I4: VIEW PROFILE ALERTS =====

/**
 * I4: View Profile Alerts
 * Driver views notifications about profile updates, document verification, and security alerts
 */
export const getProfileAlerts = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('👤 Getting profile alerts for driver:', user.id)

    // Get profile-related notifications
    const profileNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'profile' } }
        ]
      },
      sort: '-createdAt',
      limit: 50
    })

    const notifications = profileNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt,
      metadata: {
        profileField: notification.profileField,
        documentType: notification.documentType,
        verificationStatus: notification.verificationStatus,
        securityLevel: notification.securityLevel
      }
    }))

    return new Response(JSON.stringify({
      success: true,
      notifications,
      total: profileNotifications.totalDocs,
      unreadCount: notifications.filter(n => !n.isRead).length,
      securityAlerts: notifications.filter(n => n.metadata.securityLevel === 'high').length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get profile alerts error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get profile alerts',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== I5: VIEW NOTIFICATION HISTORY =====

/**
 * I5: View Notification History
 * Driver views complete notification history with filtering and search
 */
export const getNotificationHistory = async (req: PayloadRequest): Promise<Response> => {
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
    const type = searchParams.get('type') // payout, earnings, magazine, profile, all
    const priority = searchParams.get('priority') // low, medium, high, all
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('📋 Getting notification history for driver:', user.id, 'Type:', type, 'Priority:', priority)

    // Build where clause
    const whereConditions: any[] = [
      { driver: { equals: user.id } }
    ]

    if (type && type !== 'all') {
      whereConditions.push({ type: { equals: type } })
    }

    if (priority && priority !== 'all') {
      whereConditions.push({ priority: { equals: priority } })
    }

    // Get all notifications with pagination
    const allNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: { and: whereConditions },
      sort: '-createdAt',
      limit,
      page: Math.floor(offset / limit) + 1
    })

    const notifications = allNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      metadata: notification.metadata || {}
    }))

    // Get summary stats
    const stats = {
      total: allNotifications.totalDocs,
      unread: notifications.filter(n => !n.isRead).length,
      byType: {
        payout: notifications.filter(n => n.type === 'payout').length,
        earnings: notifications.filter(n => n.type === 'earnings').length,
        magazine: notifications.filter(n => n.type === 'magazine').length,
        profile: notifications.filter(n => n.type === 'profile').length
      },
      byPriority: {
        high: notifications.filter(n => n.priority === 'high').length,
        medium: notifications.filter(n => n.priority === 'medium').length,
        low: notifications.filter(n => n.priority === 'low').length
      }
    }

    return new Response(JSON.stringify({
      success: true,
      notifications,
      stats,
      pagination: {
        limit,
        offset,
        total: allNotifications.totalDocs,
        hasMore: offset + limit < allNotifications.totalDocs
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get notification history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get notification history',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== I6: MARK NOTIFICATIONS AS READ =====

/**
 * I6: Mark Notifications as Read
 * Driver marks individual or multiple notifications as read
 */
export const markNotificationsAsRead = async (req: PayloadRequest): Promise<Response> => {
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

    // Use body if already parsed, otherwise parse it
    let body: any = req.body
    if (!body || typeof body === 'string' || body instanceof ReadableStream) {
      body = req.json ? await req.json() : {}
    }
    const { notificationIds, markAll } = body

    console.log('✅ Marking notifications as read for driver:', user.id, 'IDs:', notificationIds, 'Mark All:', markAll)

    let updatedCount = 0

    if (markAll) {
      // Mark all notifications as read for this driver
      const allNotifications = await req.payload.find({
        collection: 'driver-notifications',
        where: {
          and: [
            { driver: { equals: user.id } },
            { isRead: { equals: false } }
          ]
        },
        limit: 1000
      })

      for (const notification of allNotifications.docs) {
        await req.payload.update({
          collection: 'driver-notifications',
          id: notification.id,
          data: {
            isRead: true,
            readAt: new Date().toISOString()
          }
        })
        updatedCount++
      }
    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      for (const notificationId of notificationIds) {
        try {
          // Verify notification belongs to user
          const notification = await req.payload.findByID({
            collection: 'driver-notifications',
            id: notificationId
          })

          if (notification.driver === user.id) {
            await req.payload.update({
              collection: 'driver-notifications',
              id: notificationId,
              data: {
                isRead: true,
                readAt: new Date().toISOString()
              }
            })
            updatedCount++
          }
        } catch (error) {
          console.warn('⚠️ Failed to update notification:', notificationId, error)
        }
      }
    }

    console.log('✅ Marked', updatedCount, 'notifications as read')

    return new Response(JSON.stringify({
      success: true,
      updatedCount,
      message: `Successfully marked ${updatedCount} notifications as read`
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Mark notifications as read error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to mark notifications as read',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== NOTIFICATION PREFERENCES =====

/**
 * Get Notification Preferences
 * Driver views and manages notification preferences
 */
export const getNotificationPreferences = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('⚙️ Getting notification preferences for driver:', user.id)

    // Get or create notification preferences
    const preferences = await req.payload.find({
      collection: 'driver-notification-preferences',
      where: { driver: { equals: user.id } },
      limit: 1
    })

    let prefs: NotificationPreferences

    if (preferences.docs.length === 0) {
      // Create default preferences
      const defaultPrefs = await req.payload.create({
        collection: 'driver-notification-preferences',
        data: {
          driver: user.id,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
          payoutAlerts: true,
          earningsAlerts: true,
          magazineAlerts: true,
          profileAlerts: true,
          createdAt: new Date().toISOString()
        }
      })
      prefs = defaultPrefs
    } else {
      prefs = preferences.docs[0]
    }

    return new Response(JSON.stringify({
      success: true,
      preferences: {
        emailNotifications: prefs.emailNotifications,
        smsNotifications: prefs.smsNotifications,
        pushNotifications: prefs.pushNotifications,
        payoutAlerts: prefs.payoutAlerts,
        earningsAlerts: prefs.earningsAlerts,
        magazineAlerts: prefs.magazineAlerts,
        profileAlerts: prefs.profileAlerts
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get notification preferences error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get notification preferences',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Update Notification Preferences
 * Driver updates their notification preferences
 */
export const updateNotificationPreferences = async (req: PayloadRequest): Promise<Response> => {
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

    const body = await req.json()
    const {
      emailNotifications,
      smsNotifications,
      pushNotifications,
      payoutAlerts,
      earningsAlerts,
      magazineAlerts,
      profileAlerts
    } = body

    console.log('⚙️ Updating notification preferences for driver:', user.id)

    // Get existing preferences
    const preferences = await req.payload.find({
      collection: 'driver-notification-preferences',
      where: { driver: { equals: user.id } },
      limit: 1
    })

    let updatedPreferences

    if (preferences.docs.length === 0) {
      // Create new preferences
      updatedPreferences = await req.payload.create({
        collection: 'driver-notification-preferences',
        data: {
          driver: user.id,
          emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
          smsNotifications: smsNotifications !== undefined ? smsNotifications : true,
          pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
          payoutAlerts: payoutAlerts !== undefined ? payoutAlerts : true,
          earningsAlerts: earningsAlerts !== undefined ? earningsAlerts : true,
          magazineAlerts: magazineAlerts !== undefined ? magazineAlerts : true,
          profileAlerts: profileAlerts !== undefined ? profileAlerts : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
    } else {
      // Update existing preferences
      updatedPreferences = await req.payload.update({
        collection: 'driver-notification-preferences',
        id: preferences.docs[0].id,
        data: {
          emailNotifications: emailNotifications !== undefined ? emailNotifications : preferences.docs[0].emailNotifications,
          smsNotifications: smsNotifications !== undefined ? smsNotifications : preferences.docs[0].smsNotifications,
          pushNotifications: pushNotifications !== undefined ? pushNotifications : preferences.docs[0].pushNotifications,
          payoutAlerts: payoutAlerts !== undefined ? payoutAlerts : preferences.docs[0].payoutAlerts,
          earningsAlerts: earningsAlerts !== undefined ? earningsAlerts : preferences.docs[0].earningsAlerts,
          magazineAlerts: magazineAlerts !== undefined ? magazineAlerts : preferences.docs[0].magazineAlerts,
          profileAlerts: profileAlerts !== undefined ? profileAlerts : preferences.docs[0].profileAlerts,
          updatedAt: new Date().toISOString()
        }
      })
    }

    console.log('✅ Updated notification preferences')

    return new Response(JSON.stringify({
      success: true,
      preferences: {
        emailNotifications: updatedPreferences.emailNotifications,
        smsNotifications: updatedPreferences.smsNotifications,
        pushNotifications: updatedPreferences.pushNotifications,
        payoutAlerts: updatedPreferences.payoutAlerts,
        earningsAlerts: updatedPreferences.earningsAlerts,
        magazineAlerts: updatedPreferences.magazineAlerts,
        profileAlerts: updatedPreferences.profileAlerts,
        updatedAt: updatedPreferences.updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update notification preferences error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update notification preferences',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== NOTIFICATION CENTER OVERVIEW =====

/**
 * Get Notification Center Overview
 * Driver gets complete notification center with unread counts and preferences
 */
export const getNotificationCenter = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('📱 Getting notification center for driver:', user.id)

    // Get unread counts by type
    const payoutUnread = await req.payload.count({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'payout' } },
          { isRead: { equals: false } }
        ]
      }
    })

    const earningsUnread = await req.payload.count({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'earnings' } },
          { isRead: { equals: false } }
        ]
      }
    })

    const magazineUnread = await req.payload.count({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'magazine' } },
          { isRead: { equals: false } }
        ]
      }
    })

    const profileUnread = await req.payload.count({
      collection: 'driver-notifications',
      where: {
        and: [
          { driver: { equals: user.id } },
          { type: { equals: 'profile' } },
          { isRead: { equals: false } }
        ]
      }
    })

    const totalUnread = payoutUnread.totalDocs + earningsUnread.totalDocs + magazineUnread.totalDocs + profileUnread.totalDocs

    // Get recent notifications
    const recentNotifications = await req.payload.find({
      collection: 'driver-notifications',
      where: { driver: { equals: user.id } },
      sort: '-createdAt',
      limit: 10
    })

    const notifications = recentNotifications.docs.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead || false,
      priority: notification.priority || 'medium',
      createdAt: notification.createdAt
    }))

    // Get preferences
    const preferences = await req.payload.find({
      collection: 'driver-notification-preferences',
      where: { driver: { equals: user.id } },
      limit: 1
    })

    const prefs = preferences.docs.length > 0 ? preferences.docs[0] : {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      payoutAlerts: true,
      earningsAlerts: true,
      magazineAlerts: true,
      profileAlerts: true
    }

    return new Response(JSON.stringify({
      success: true,
      notificationCenter: {
        unreadCount: totalUnread,
        unreadByType: {
          payout: payoutUnread.totalDocs,
          earnings: earningsUnread.totalDocs,
          magazine: magazineUnread.totalDocs,
          profile: profileUnread.totalDocs
        },
        recentNotifications: notifications,
        preferences: {
          emailNotifications: prefs.emailNotifications,
          smsNotifications: prefs.smsNotifications,
          pushNotifications: prefs.pushNotifications,
          payoutAlerts: prefs.payoutAlerts,
          earningsAlerts: prefs.earningsAlerts,
          magazineAlerts: prefs.magazineAlerts,
          profileAlerts: prefs.profileAlerts
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get notification center error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get notification center',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

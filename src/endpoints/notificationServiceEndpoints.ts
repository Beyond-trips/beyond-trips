import { PayloadRequest } from 'payload'
import { sendEmail } from '../lib/email'

// ===== NOTIFICATION SERVICE ENDPOINTS =====

/**
 * Send email notification
 */
export const sendEmailNotification = async (
  req: PayloadRequest,
  email: string,
  subject: string,
  template: string,
  variables: Record<string, any> = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Get email template
    const templates = await req.payload.find({
      collection: 'notification-templates',
      where: { templateId: { equals: template }, type: { equals: 'email' } },
      limit: 1
    })

    let htmlContent = templates.docs[0]?.content || '<p>{message}</p>'
    
    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      htmlContent = htmlContent.replace(`{${key}}`, String(value))
    })

    console.log(`📧 Sending email to ${email}`)

    const result = await sendEmail(email, subject, htmlContent)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    console.log(`✅ Email sent via Postmark: ${result.messageId}`)

    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('❌ Send email error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Send SMS notification - DEPRECATED: All notifications now use email
 */
export const sendSMSNotification = async (
  req: PayloadRequest,
  phoneNumber: string,
  message: string,
  templateId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  console.log('⚠️ SMS notifications are disabled. All notifications are sent via email.')
  return { success: false, error: 'SMS notifications are disabled. Use email instead.' }
}

/**
 * Send push notification - DEPRECATED: All notifications now use email
 */
export const sendPushNotification = async (
  req: PayloadRequest,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  console.log('⚠️ Push notifications are disabled. All notifications are sent via email.')
  return { success: false, error: 'Push notifications are disabled. Use email instead.' }
}

/**
 * Send multi-channel notification
 * POST /api/notifications/send
 */
export const sendNotification = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req

    if (!user || user.userType !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const {
      recipientId,
      email,
      phoneNumber,
      channels = ['email'], // 'email', 'sms', 'push'
      subject,
      title,
      message,
      template,
      variables = {}
    } = body

    console.log(`📢 Sending multi-channel notification`)

    const results: Record<string, any> = {}

    // Send email if requested
    if (channels.includes('email') && email) {
      const emailResult = await sendEmailNotification(
        req,
        email,
        subject || 'Notification from Beyond Trips',
        template || 'default',
        variables
      )
      results.email = emailResult
    }

    // Send SMS if requested
    if (channels.includes('sms') && phoneNumber) {
      const smsResult = await sendSMSNotification(
        req,
        phoneNumber,
        message || 'Notification from Beyond Trips',
        template
      )
      results.sms = smsResult
    }

    // Send push if requested
    if (channels.includes('push') && recipientId) {
      const pushResult = await sendPushNotification(
        req,
        recipientId,
        title || 'Notification',
        message || 'New notification'
      )
      results.push = pushResult
    }

    // Check if at least one succeeded
    const succeeded = Object.values(results).some((r: any) => r.success)

    return new Response(JSON.stringify({
      success: succeeded,
      channels: results,
      message: succeeded ? 'Notification sent' : 'Failed to send notification'
    }), {
      status: succeeded ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Send notification error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get notification history
 * GET /api/notifications/history
 */
export const getNotificationHistory = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get notifications for user
    const notifications = await req.payload.find({
      collection: 'driver-notifications',
      where: {
        recipientUserId: { equals: user.id }
      },
      sort: '-sentAt',
      limit: 50
    })

    return new Response(JSON.stringify({
      success: true,
      notifications: notifications.docs.map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        subject: notif.subject,
        message: notif.message,
        status: notif.status,
        sentAt: notif.sentAt,
        readAt: notif.readAt
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Get notification history error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get notifications' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Mark notification as read
 * POST /api/notifications/read
 */
export const markNotificationAsRead = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { notificationId } = body

    if (!notificationId) {
      return new Response(JSON.stringify({ error: 'Notification ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await req.payload.update({
      collection: 'driver-notifications',
      id: notificationId,
      data: {
        readAt: new Date().toISOString(),
        status: 'read'
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification marked as read'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Mark notification as read error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update notification' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export default {
  sendEmailNotification,
  sendSMSNotification,
  sendPushNotification,
  sendNotification,
  getNotificationHistory,
  markNotificationAsRead
}

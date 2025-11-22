import type { Payload } from 'payload'
import { sendEmail } from '../../lib/email'

interface AdminNotificationData {
  adminId?: string // Optional - if not provided, notify all admins
  type: 'support_ticket' | 'gdpr_request' | 'new_driver' | 'new_advertiser' | 'system_alert' | 'driver_request' | 'advertiser_request' | 'general'
  title: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  metadata?: Record<string, any>
  // Specific fields
  ticketId?: string
  ticketNumber?: string
  userId?: string
  userEmail?: string
  requestType?: string
}

/**
 * Send notification to admin(s)
 * Central service for creating admin notifications across the system
 */
export async function sendAdminNotification(
  payload: Payload,
  data: AdminNotificationData
): Promise<{ success: boolean; notificationIds?: string[]; error?: string }> {
  try {
    console.log(`📧 Sending ${data.type} notification to admin${data.adminId ? `: ${data.adminId}` : 's (all)'}`)

    const notificationIds: string[] = []
    
    // Determine which admins to notify
    let adminsToNotify: any[] = []
    
    if (data.adminId) {
      // Notify specific admin
      const admin = await payload.findByID({
        collection: 'users',
        id: data.adminId
      }).catch(() => null)
      
      if (admin && admin.role === 'admin') {
        adminsToNotify = [admin]
      }
    } else {
      // Notify all admins
      const admins = await payload.find({
        collection: 'users',
        where: { role: { equals: 'admin' } },
        limit: 100
      })
      
      adminsToNotify = admins.docs
    }

    if (adminsToNotify.length === 0) {
      console.error('❌ No admins found to notify')
      return { success: false, error: 'No admins found' }
    }

    // Create notification and send email for each admin
    for (const admin of adminsToNotify) {
      try {
        // Create notification
        const notification = await payload.create({
          collection: 'admin-notifications',
          data: {
            admin: admin.id,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || 'medium',
            actionUrl: data.actionUrl,
            isRead: false,
            metadata: data.metadata,
            ticketId: data.ticketId,
            ticketNumber: data.ticketNumber,
            userId: data.userId,
            userEmail: data.userEmail,
            requestType: data.requestType,
          }
        })

        notificationIds.push(notification.id)
        console.log('✅ Notification created for admin:', admin.id, notification.id)

        // Send email notification
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${data.title}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #333; margin: 0; font-size: 24px;">🔔 Admin Alert</h1>
                </div>
                
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <h2 style="color: #856404; margin: 0 0 10px 0; font-size: 18px;">${data.title}</h2>
                  <p style="color: #856404; font-size: 14px; margin: 0;">
                    ${data.message}
                  </p>
                </div>
                
                ${data.actionUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'https://beyondtrip.co.uk'}${data.actionUrl}" 
                     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            text-decoration: none; 
                            padding: 15px 30px; 
                            border-radius: 8px; 
                            font-size: 16px; 
                            font-weight: bold; 
                            display: inline-block;">
                    Take Action
                  </a>
                </div>
                ` : ''}
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <div style="text-align: center;">
                  <p style="color: #999; font-size: 14px; margin: 0;">
                    This is an admin notification from Beyond Trip.
                  </p>
                  <p style="color: #999; font-size: 14px; margin: 10px 0 0 0;">
                    Sent via Postmark
                  </p>
                </div>
              </div>
            </body>
            </html>
          `

          const emailResult = await sendEmail(
            admin.email,
            `[Admin] ${data.title}`,
            emailHtml
          )

          if (!emailResult.success) {
            console.warn('⚠️ Email notification failed for admin:', admin.id, emailResult.error)
          } else {
            console.log('📧 Email notification sent to admin:', admin.email, emailResult.messageId)
          }
        } catch (emailError) {
          console.error('⚠️ Error sending email notification to admin:', admin.id, emailError)
          // Don't fail the whole notification if email fails
        }
      } catch (notificationError) {
        console.error('⚠️ Failed to create notification for admin:', admin.id, notificationError)
        // Continue with other admins
      }
    }

    return { success: true, notificationIds }

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Send support ticket notification (new ticket created)
 */
export async function sendSupportTicketNotification(
  payload: Payload,
  ticketId: string,
  ticketNumber: string,
  userId: string,
  userEmail: string,
  subject: string
): Promise<{ success: boolean; notificationIds?: string[] }> {
  return sendAdminNotification(payload, {
    type: 'support_ticket',
    title: 'New Support Ticket',
    message: `New support ticket #${ticketNumber} from ${userEmail}: "${subject}"`,
    priority: 'high',
    ticketId,
    ticketNumber,
    userId,
    userEmail,
    actionUrl: `/admin/support/${ticketId}`
  })
}

/**
 * Send GDPR data deletion request notification
 */
export async function sendGDPRRequestNotification(
  payload: Payload,
  userId: string,
  userEmail: string,
  requestType: 'deletion' | 'export'
): Promise<{ success: boolean; notificationIds?: string[] }> {
  return sendAdminNotification(payload, {
    type: 'gdpr_request',
    title: `GDPR ${requestType === 'deletion' ? 'Data Deletion' : 'Data Export'} Request`,
    message: `User ${userEmail} has requested ${requestType === 'deletion' ? 'data deletion' : 'data export'}. Action required within 30 days per GDPR compliance.`,
    priority: 'urgent',
    userId,
    userEmail,
    requestType,
    actionUrl: `/admin/gdpr/requests`
  })
}

/**
 * Send system alert notification
 */
export async function sendSystemAlertNotification(
  payload: Payload,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<{ success: boolean; notificationIds?: string[] }> {
  return sendAdminNotification(payload, {
    type: 'system_alert',
    title,
    message,
    priority,
    actionUrl: `/admin/dashboard`
  })
}


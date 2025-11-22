// New file: src/services/notifications/dispatcher.ts
import type { Payload } from 'payload'

export interface NotificationPayload {
  userId: string
  type: 'email' | 'sms' | 'push' | 'in_app'
  template: string
  data: Record<string, any>
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  scheduledFor?: string
}

export interface DeliveryLog {
  notificationId: string
  channel: 'email' | 'sms' | 'push' | 'in_app'
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  sentAt?: string
  deliveredAt?: string
  failureReason?: string
  attempts: number
}

/**
 * Multi-channel notification dispatcher
 * Handles email, SMS, push notifications, and in-app notifications
 */
export class NotificationDispatcher {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Send a notification through specified channel(s)
   */
  async send(notification: NotificationPayload): Promise<{ success: boolean; deliveryLog?: DeliveryLog; error?: string }> {
    try {
      console.log(`📨 Dispatching ${notification.type} notification to user ${notification.userId}`)

      // Get user details
      const user = await this.payload.findByID({
        collection: 'users',
        id: notification.userId
      })

      if (!user) {
        return { success: false, error: 'User not found' }
      }

      // Get notification template
      const template = await this.getTemplate(notification.template)
      if (!template) {
        return { success: false, error: 'Template not found' }
      }

      // Render template with data
      const rendered = this.renderTemplate(template, notification.data)

      // Dispatch based on channel
      let deliveryLog: DeliveryLog | undefined

      switch (notification.type) {
        case 'email':
          deliveryLog = await this.sendEmail(user, rendered)
          break
        case 'sms':
          deliveryLog = await this.sendSMS(user, rendered)
          break
        case 'push':
          deliveryLog = await this.sendPush(user, rendered)
          break
        case 'in_app':
          deliveryLog = await this.sendInApp(user, rendered)
          break
        default:
          return { success: false, error: 'Invalid notification type' }
      }

      // Log delivery
      await this.logDelivery(deliveryLog)

      return { success: true, deliveryLog }

    } catch (error: any) {
      console.error('❌ Notification dispatch error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send notification to multiple channels
   */
  async sendMultiChannel(
    userId: string,
    channels: Array<'email' | 'sms' | 'push' | 'in_app'>,
    template: string,
    data: Record<string, any>,
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<{ success: boolean; results: Array<{ channel: string; success: boolean; error?: string }> }> {
    const results = []

    for (const channel of channels) {
      const result = await this.send({
        userId,
        type: channel,
        template,
        data,
        priority
      })

      results.push({
        channel,
        success: result.success,
        error: result.error
      })
    }

    const allSuccessful = results.every(r => r.success)

    return {
      success: allSuccessful,
      results
    }
  }

  /**
   * Get notification template
   */
  private async getTemplate(templateName: string): Promise<any> {
    try {
      const templates = await this.payload.find({
        collection: 'notification-templates',
        where: { name: { equals: templateName }, isActive: { equals: true } },
        limit: 1
      })

      return templates.docs[0] || null
    } catch (error) {
      console.error('Error fetching template:', error)
      return null
    }
  }

  /**
   * Render template with data
   */
  private renderTemplate(template: any, data: Record<string, any>): { subject?: string; body: string; smsText?: string } {
    const rendered = {
      subject: template.subject || '',
      body: template.body || '',
      smsText: template.smsText || ''
    }

    // Simple variable replacement (e.g., {{userName}} -> actual value)
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`
      rendered.subject = rendered.subject?.replace(new RegExp(placeholder, 'g'), data[key])
      rendered.body = rendered.body?.replace(new RegExp(placeholder, 'g'), data[key])
      rendered.smsText = rendered.smsText?.replace(new RegExp(placeholder, 'g'), data[key])
    })

    return rendered
  }

  /**
   * Send email notification
   */
  private async sendEmail(user: any, content: { subject?: string; body: string }): Promise<DeliveryLog> {
    const deliveryLog: DeliveryLog = {
      notificationId: `email-${Date.now()}`,
      channel: 'email',
      status: 'pending',
      attempts: 0
    }

    try {
      console.log(`📧 Sending email to ${user.email}:`, content.subject)
      
      // Use existing Postmark SMTP email service
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.default.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '2525'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          ciphers: 'SSLv3',
        },
      })

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'hello@beyondtrip.co.uk',
        to: user.email,
        subject: content.subject || 'Notification',
        html: content.body,
        text: content.body.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
      }

      const result = await transporter.sendMail(mailOptions)
      console.log('✅ Email sent successfully via Postmark:', result.messageId)

      deliveryLog.status = 'sent'
      deliveryLog.sentAt = new Date().toISOString()
      deliveryLog.attempts = 1
      deliveryLog.status = 'delivered'
      deliveryLog.deliveredAt = new Date().toISOString()

    } catch (error: any) {
      console.error('❌ Email sending failed:', error)
      deliveryLog.status = 'failed'
      deliveryLog.failureReason = error.message
      deliveryLog.attempts = 1
    }

    return deliveryLog
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(user: any, content: { smsText?: string }): Promise<DeliveryLog> {
    const deliveryLog: DeliveryLog = {
      notificationId: `sms-${Date.now()}`,
      channel: 'sms',
      status: 'pending',
      attempts: 0
    }

    try {
      const phoneNumber = (user as any).phoneNumber
      if (!phoneNumber) {
        throw new Error('User has no phone number')
      }

      // TODO: Integrate with actual SMS service (Twilio, AWS SNS, etc.)
      console.log(`📱 Sending SMS to ${phoneNumber}:`, content.smsText)

      // Placeholder for actual SMS sending logic
      // await smsService.send({
      //   to: phoneNumber,
      //   message: content.smsText
      // })

      deliveryLog.status = 'sent'
      deliveryLog.sentAt = new Date().toISOString()
      deliveryLog.attempts = 1

      deliveryLog.status = 'delivered'
      deliveryLog.deliveredAt = new Date().toISOString()

    } catch (error: any) {
      deliveryLog.status = 'failed'
      deliveryLog.failureReason = error.message
      deliveryLog.attempts = 1
    }

    return deliveryLog
  }

  /**
   * Send push notification
   */
  private async sendPush(user: any, content: { subject?: string; body: string }): Promise<DeliveryLog> {
    const deliveryLog: DeliveryLog = {
      notificationId: `push-${Date.now()}`,
      channel: 'push',
      status: 'pending',
      attempts: 0
    }

    try {
      // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
      console.log(`🔔 Sending push notification to user ${user.id}:`, content.subject)

      // Placeholder for actual push notification logic
      // await pushService.send({
      //   userId: user.id,
      //   title: content.subject,
      //   body: content.body
      // })

      deliveryLog.status = 'sent'
      deliveryLog.sentAt = new Date().toISOString()
      deliveryLog.attempts = 1

      deliveryLog.status = 'delivered'
      deliveryLog.deliveredAt = new Date().toISOString()

    } catch (error: any) {
      deliveryLog.status = 'failed'
      deliveryLog.failureReason = error.message
      deliveryLog.attempts = 1
    }

    return deliveryLog
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(user: any, content: { subject?: string; body: string }): Promise<DeliveryLog> {
    const deliveryLog: DeliveryLog = {
      notificationId: `inapp-${Date.now()}`,
      channel: 'in_app',
      status: 'pending',
      attempts: 0
    }

    try {
      // Determine user role and create appropriate notification
      const userRole = user.role
      let notificationCollection = 'driver-notifications'

      if (userRole === 'partner' || userRole === 'advertiser') {
        notificationCollection = 'advertiser-notifications'
      } else if (userRole === 'admin') {
        notificationCollection = 'admin-notifications'
      }

      // Create in-app notification
      await this.payload.create({
        collection: notificationCollection as any,
        data: {
          [userRole === 'partner' || userRole === 'advertiser' ? 'advertiser' : userRole === 'admin' ? 'admin' : 'driver']: user.id,
          type: 'system',
          title: content.subject || 'Notification',
          message: content.body,
          isRead: false,
          priority: 'medium'
        }
      })

      deliveryLog.status = 'delivered'
      deliveryLog.sentAt = new Date().toISOString()
      deliveryLog.deliveredAt = new Date().toISOString()
      deliveryLog.attempts = 1

    } catch (error: any) {
      deliveryLog.status = 'failed'
      deliveryLog.failureReason = error.message
      deliveryLog.attempts = 1
    }

    return deliveryLog
  }

  /**
   * Log delivery attempt
   */
  private async logDelivery(log: DeliveryLog): Promise<void> {
    try {
      await this.payload.create({
        collection: 'notification-logs',
        data: {
          notificationId: log.notificationId,
          channel: log.channel,
          status: log.status,
          sentAt: log.sentAt,
          deliveredAt: log.deliveredAt,
          failureReason: log.failureReason,
          attempts: log.attempts
        }
      })
    } catch (error) {
      console.error('Error logging delivery:', error)
    }
  }
}

/**
 * Helper function to get dispatcher instance
 */
export function getNotificationDispatcher(payload: Payload): NotificationDispatcher {
  return new NotificationDispatcher(payload)
}


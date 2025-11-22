import type { Payload } from 'payload'
import { sendEmail } from '../../lib/email'

interface NotificationData {
  driverId: string
  type: 'payout' | 'earnings' | 'magazine' | 'profile' | 'system'
  title: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  metadata?: Record<string, any>
  // Specific fields based on type
  payoutId?: string
  amount?: number
  payoutStatus?: string
  earningsAmount?: number
  campaignId?: string
  magazineName?: string
  pickupLocation?: string
  dueDate?: string
  actionRequired?: boolean
  profileField?: string
  documentType?: string
  verificationStatus?: string
  securityLevel?: 'low' | 'medium' | 'high'
}

/**
 * Send notification to a driver
 * Central service for creating driver notifications across the system
 */
export async function sendDriverNotification(
  payload: Payload,
  data: NotificationData
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    console.log(`📧 Sending ${data.type} notification to driver:`, data.driverId)

    // Check if driver exists
    const driver = await payload.findByID({
      collection: 'users',
      id: data.driverId
    }).catch(() => null)

    if (!driver) {
      console.error('❌ Driver not found:', data.driverId)
      return { success: false, error: 'Driver not found' }
    }

    // Check driver preferences
    const preferences = await payload.find({
      collection: 'driver-notification-preferences',
      where: { driver: { equals: data.driverId } },
      limit: 1
    })

    const prefs = preferences.docs[0]
    
    // Check if driver has this type of notification enabled
    if (prefs) {
      const typeToPreferenceMap: Record<string, keyof typeof prefs> = {
        payout: 'payoutAlerts',
        earnings: 'earningsAlerts',
        magazine: 'magazineAlerts',
        profile: 'profileAlerts',
      }
      
      const preferenceKey = typeToPreferenceMap[data.type]
      if (preferenceKey && !(prefs as any)[preferenceKey]) {
        console.log(`⏭️  Driver has disabled ${data.type} notifications`)
        return { success: true, notificationId: 'skipped-by-preference' }
      }
    }

    // Create notification
    const notification = await payload.create({
      collection: 'driver-notifications',
      data: {
        driver: data.driverId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'medium',
        actionUrl: data.actionUrl,
        isRead: false,
        metadata: data.metadata,
        // Type-specific fields
        payoutId: data.payoutId,
        amount: data.amount,
        payoutStatus: data.payoutStatus,
        earningsAmount: data.earningsAmount,
        campaignId: data.campaignId,
        magazineName: data.magazineName,
        pickupLocation: data.pickupLocation,
        dueDate: data.dueDate,
        actionRequired: data.actionRequired,
        profileField: data.profileField,
        documentType: data.documentType,
        verificationStatus: data.verificationStatus,
        securityLevel: data.securityLevel,
      }
    })

    console.log('✅ Notification created:', notification.id)

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
              <h1 style="color: #333; margin: 0; font-size: 24px;">${data.title}</h1>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
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
                View Details
              </a>
            </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
            
            <div style="text-align: center;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                This is an automated notification from Beyond Trip.
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
        (driver as any).email,
        data.title,
        emailHtml
      )

      if (!emailResult.success) {
        console.warn('⚠️ Email notification failed:', emailResult.error)
      } else {
        console.log('📧 Email notification sent:', emailResult.messageId)
      }
    } catch (emailError) {
      console.error('⚠️ Error sending email notification:', emailError)
      // Don't fail the whole notification if email fails
    }

    return { success: true, notificationId: notification.id }

  } catch (error) {
    console.error('❌ Failed to send driver notification:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Send payout notification (approval, rejection, completion)
 */
export async function sendPayoutNotification(
  payload: Payload,
  driverId: string,
  status: 'approved' | 'rejected' | 'completed',
  payoutId: string,
  amount: number,
  notes?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const messages = {
    approved: `Your withdrawal request of ₦${amount.toLocaleString()} has been approved and will be processed soon.`,
    rejected: `Your withdrawal request of ₦${amount.toLocaleString()} has been rejected. ${notes || 'Please contact support for more information.'}`,
    completed: `Your withdrawal of ₦${amount.toLocaleString()} has been completed and transferred to your account.`
  }

  return sendDriverNotification(payload, {
    driverId,
    type: 'payout',
    title: `Withdrawal ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: messages[status],
    priority: status === 'rejected' ? 'high' : 'medium',
    payoutId,
    amount,
    payoutStatus: status,
    actionUrl: '/driver/earnings'
  })
}

/**
 * Send earnings notification
 */
export async function sendEarningsNotification(
  payload: Payload,
  driverId: string,
  earningsAmount: number,
  campaignId?: string,
  magazineName?: string
): Promise<{ success: boolean; notificationId?: string }> {
  return sendDriverNotification(payload, {
    driverId,
    type: 'earnings',
    title: 'New Earnings',
    message: `You've earned ₦${earningsAmount.toLocaleString()}${magazineName ? ` from ${magazineName}` : ''}.`,
    priority: 'medium',
    earningsAmount,
    campaignId,
    magazineName,
    actionUrl: '/driver/earnings'
  })
}

/**
 * Send magazine notification (availability, pickup reminder, return deadline)
 */
export async function sendMagazineNotification(
  payload: Payload,
  driverId: string,
  notificationType: 'availability' | 'pickup-reminder' | 'return-deadline' | 'approved' | 'rejected',
  magazineName: string,
  pickupLocation?: string,
  dueDate?: string,
  rejectionReason?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const messages = {
    availability: `New magazine edition "${magazineName}" is now available for pickup${pickupLocation ? ` at ${pickupLocation}` : ''}.`,
    'pickup-reminder': `Reminder: You have a pending magazine pickup for "${magazineName}"${pickupLocation ? ` at ${pickupLocation}` : ''}.`,
    'return-deadline': `Reminder: Magazine "${magazineName}" is due for return${dueDate ? ` by ${dueDate}` : ''}.`,
    approved: `Your magazine pickup request for "${magazineName}" has been approved. You can now collect it${pickupLocation ? ` at ${pickupLocation}` : ''}.`,
    rejected: `Your magazine pickup request for "${magazineName}" has been rejected. ${rejectionReason || 'Please contact admin for more information.'}`
  }

  return sendDriverNotification(payload, {
    driverId,
    type: 'magazine',
    title: notificationType === 'availability' ? 'New Magazine Available' : 
           notificationType === 'pickup-reminder' ? 'Pickup Reminder' :
           notificationType === 'return-deadline' ? 'Return Reminder' :
           notificationType === 'approved' ? 'Pickup Approved' : 'Pickup Rejected',
    message: messages[notificationType],
    priority: notificationType === 'return-deadline' ? 'high' : 'medium',
    magazineName,
    pickupLocation,
    dueDate,
    actionRequired: notificationType === 'return-deadline' || notificationType === 'approved',
    actionUrl: '/driver/magazines'
  })
}

/**
 * Send profile notification (document verification, profile updates, security alerts)
 */
export async function sendProfileNotification(
  payload: Payload,
  driverId: string,
  notificationType: 'document-verified' | 'document-rejected' | 'profile-incomplete' | 'security-alert',
  documentType?: string,
  profileField?: string,
  securityLevel?: 'low' | 'medium' | 'high',
  customMessage?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const messages = {
    'document-verified': `Your ${documentType || 'document'} has been verified successfully.`,
    'document-rejected': `Your ${documentType || 'document'} has been rejected. Please resubmit with correct information.`,
    'profile-incomplete': `Your profile is incomplete. Please update ${profileField || 'missing information'} to continue.`,
    'security-alert': customMessage || 'There has been unusual activity on your account. Please review your security settings.'
  }

  return sendDriverNotification(payload, {
    driverId,
    type: 'profile',
    title: notificationType === 'document-verified' ? 'Document Verified' :
           notificationType === 'document-rejected' ? 'Document Rejected' :
           notificationType === 'profile-incomplete' ? 'Profile Incomplete' : 'Security Alert',
    message: messages[notificationType],
    priority: notificationType === 'security-alert' ? 'urgent' : 
             notificationType === 'document-rejected' ? 'high' : 'medium',
    documentType,
    profileField,
    verificationStatus: notificationType.includes('document') ? 
      (notificationType === 'document-verified' ? 'verified' : 'rejected') : undefined,
    securityLevel,
    actionUrl: notificationType === 'security-alert' ? '/driver/profile/security' : '/driver/profile'
  })
}


import type { Payload } from 'payload'
import { sendEmail } from '../../lib/email'

interface AdvertiserNotificationData {
  advertiserId: string
  type: 'campaign_status' | 'creative_approval' | 'creative_rejection' | 'invoice_payment' | 'invoice_cancellation' | 'support_response' | 'support_resolution' | 'system' | 'general'
  title: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  metadata?: Record<string, any>
  // Specific fields based on type
  campaignId?: string
  campaignStatus?: string
  creativeId?: string
  creativeName?: string
  rejectionReason?: string
  invoiceId?: string
  invoiceNumber?: string
  amount?: number
  ticketId?: string
  ticketNumber?: string
}

/**
 * Send notification to an advertiser
 * Central service for creating advertiser notifications across the system
 */
export async function sendAdvertiserNotification(
  payload: Payload,
  data: AdvertiserNotificationData
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    console.log(`📧 Sending ${data.type} notification to advertiser:`, data.advertiserId)

    // Check if advertiser (business) exists
    const advertiser = await payload.findByID({
      collection: 'business-details',
      id: data.advertiserId
    }).catch(() => null)

    if (!advertiser) {
      console.error('❌ Advertiser not found:', data.advertiserId)
      return { success: false, error: 'Advertiser not found' }
    }

    // Create notification
    const notification = await payload.create({
      collection: 'advertiser-notifications',
      data: {
        advertiser: data.advertiserId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'medium',
        actionUrl: data.actionUrl,
        isRead: false,
        metadata: data.metadata,
        // Type-specific fields
        campaignId: data.campaignId,
        campaignStatus: data.campaignStatus,
        creativeId: data.creativeId,
        creativeName: data.creativeName,
        rejectionReason: data.rejectionReason,
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        ticketId: data.ticketId,
        ticketNumber: data.ticketNumber,
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
        (advertiser as any).companyEmail,
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
    console.error('❌ Failed to send advertiser notification:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Send campaign status notification
 */
export async function sendCampaignNotification(
  payload: Payload,
  advertiserId: string,
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active' | 'paused' | 'completed',
  campaignId: string,
  campaignName: string,
  notes?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const messages = {
    pending_approval: `Your campaign "${campaignName}" has been submitted for admin review.`,
    approved: `Great news! Your campaign "${campaignName}" has been approved and is ready to go live.`,
    rejected: `Your campaign "${campaignName}" has been rejected. ${notes || 'Please review and resubmit.'}`,
    active: `Your campaign "${campaignName}" is now live!`,
    paused: `Your campaign "${campaignName}" has been paused. ${notes || ''}`,
    completed: `Your campaign "${campaignName}" has completed its run.`,
    draft: `Your campaign "${campaignName}" has been saved as draft.`,
  }

  const titles = {
    pending_approval: 'Campaign Submitted for Review',
    approved: 'Campaign Approved',
    rejected: 'Campaign Rejected',
    active: 'Campaign Active',
    paused: 'Campaign Paused',
    completed: 'Campaign Completed',
    draft: 'Campaign Saved',
  }

  return sendAdvertiserNotification(payload, {
    advertiserId,
    type: 'campaign_status',
    title: titles[status],
    message: messages[status],
    priority: status === 'rejected' ? 'high' : 'medium',
    campaignId,
    campaignStatus: status,
    actionUrl: `/advertiser/campaigns/${campaignId}`
  })
}

/**
 * Send creative approval/rejection notification
 */
export async function sendCreativeNotification(
  payload: Payload,
  advertiserId: string,
  status: 'approved' | 'rejected',
  creativeId: string,
  creativeName: string,
  reason?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const isApproved = status === 'approved'
  
  return sendAdvertiserNotification(payload, {
    advertiserId,
    type: isApproved ? 'creative_approval' : 'creative_rejection',
    title: isApproved ? 'Creative Approved' : 'Creative Rejected',
    message: isApproved 
      ? `Your creative "${creativeName}" has been approved and is ready to use.`
      : `Your creative "${creativeName}" has been rejected. ${reason || 'Please review and resubmit.'}`,
    priority: isApproved ? 'medium' : 'high',
    creativeId,
    creativeName,
    rejectionReason: reason,
    actionUrl: `/advertiser/creatives/${creativeId}`
  })
}

/**
 * Send invoice notification
 */
export async function sendInvoiceNotification(
  payload: Payload,
  advertiserId: string,
  type: 'payment' | 'cancellation',
  invoiceId: string,
  invoiceNumber: string,
  amount?: number
): Promise<{ success: boolean; notificationId?: string }> {
  const isPayment = type === 'payment'
  
  return sendAdvertiserNotification(payload, {
    advertiserId,
    type: isPayment ? 'invoice_payment' : 'invoice_cancellation',
    title: isPayment ? 'Payment Received' : 'Invoice Cancelled',
    message: isPayment
      ? `Your payment for invoice ${invoiceNumber} has been confirmed.${amount ? ` Amount: ₦${amount.toLocaleString()}` : ''}`
      : `Invoice ${invoiceNumber} has been cancelled.`,
    priority: 'medium',
    invoiceId,
    invoiceNumber,
    amount,
    actionUrl: `/advertiser/invoices/${invoiceId}`
  })
}

/**
 * Send support ticket notification
 */
export async function sendSupportNotification(
  payload: Payload,
  advertiserId: string,
  type: 'response' | 'resolved',
  ticketId: string,
  ticketNumber: string,
  message?: string
): Promise<{ success: boolean; notificationId?: string }> {
  const isResponse = type === 'response'
  
  return sendAdvertiserNotification(payload, {
    advertiserId,
    type: isResponse ? 'support_response' : 'support_resolution',
    title: isResponse ? 'New Support Response' : 'Ticket Resolved',
    message: isResponse
      ? `Admin has responded to your support ticket #${ticketNumber}. ${message || ''}`
      : `Your support ticket #${ticketNumber} has been resolved. ${message || ''}`,
    priority: 'medium',
    ticketId,
    ticketNumber,
    actionUrl: `/advertiser/support/${ticketId}`
  })
}


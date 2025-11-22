// New file: src/utilities/notificationHelpers.ts
import type { Payload } from 'payload'
import { getNotificationDispatcher } from '../services/notifications/dispatcher'

/**
 * Notification event hooks - Easy-to-use functions for triggering notifications
 */

export class NotificationHelpers {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Send payout approved notification
   */
  async notifyPayoutApproved(driverId: string, amount: number, currency: string = 'NGN'): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'payout_approved',
        {
          amount: `${currency} ${amount.toLocaleString()}`,
          currency
        },
        'high'
      )
      console.log(`✅ Payout approved notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending payout approved notification:', error)
    }
  }

  /**
   * Send payout completed notification
   */
  async notifyPayoutCompleted(driverId: string, amount: number, transactionId: string, currency: string = 'NGN'): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email', 'sms'],
        'payout_completed',
        {
          amount: `${currency} ${amount.toLocaleString()}`,
          transactionId,
          currency
        },
        'high'
      )
      console.log(`✅ Payout completed notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending payout completed notification:', error)
    }
  }

  /**
   * Send payout rejected notification
   */
  async notifyPayoutRejected(driverId: string, amount: number, reason: string, currency: string = 'NGN'): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'payout_rejected',
        {
          amount: `${currency} ${amount.toLocaleString()}`,
          reason,
          currency
        },
        'high'
      )
      console.log(`✅ Payout rejected notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending payout rejected notification:', error)
    }
  }

  /**
   * Send campaign approved notification
   */
  async notifyCampaignApproved(advertiserId: string, campaignName: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        advertiserId,
        ['in_app', 'email'],
        'campaign_approved',
        {
          campaignName
        },
        'high'
      )
      console.log(`✅ Campaign approved notification sent to advertiser ${advertiserId}`)
    } catch (error) {
      console.error('Error sending campaign approved notification:', error)
    }
  }

  /**
   * Send campaign rejected notification
   */
  async notifyCampaignRejected(advertiserId: string, campaignName: string, reason: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        advertiserId,
        ['in_app', 'email'],
        'campaign_rejected',
        {
          campaignName,
          reason
        },
        'high'
      )
      console.log(`✅ Campaign rejected notification sent to advertiser ${advertiserId}`)
    } catch (error) {
      console.error('Error sending campaign rejected notification:', error)
    }
  }

  /**
   * Send creative approved notification
   */
  async notifyCreativeApproved(advertiserId: string, creativeName: string, campaignName: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        advertiserId,
        ['in_app', 'email'],
        'creative_approved',
        {
          creativeName,
          campaignName
        },
        'medium'
      )
      console.log(`✅ Creative approved notification sent to advertiser ${advertiserId}`)
    } catch (error) {
      console.error('Error sending creative approved notification:', error)
    }
  }

  /**
   * Send creative rejected notification
   */
  async notifyCreativeRejected(advertiserId: string, creativeName: string, reason: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        advertiserId,
        ['in_app', 'email'],
        'creative_rejected',
        {
          creativeName,
          reason
        },
        'medium'
      )
      console.log(`✅ Creative rejected notification sent to advertiser ${advertiserId}`)
    } catch (error) {
      console.error('Error sending creative rejected notification:', error)
    }
  }

  /**
   * Send support ticket response notification
   */
  async notifyTicketResponse(userId: string, ticketNumber: string, isResolved: boolean = false): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        userId,
        ['in_app', 'email'],
        isResolved ? 'ticket_resolved' : 'ticket_response',
        {
          ticketNumber,
          status: isResolved ? 'resolved' : 'updated'
        },
        isResolved ? 'high' : 'medium'
      )
      console.log(`✅ Ticket response notification sent to user ${userId}`)
    } catch (error) {
      console.error('Error sending ticket response notification:', error)
    }
  }

  /**
   * Send data deletion confirmation notification
   */
  async notifyDataDeletionRequested(userId: string, userEmail: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        userId,
        ['email'],
        'data_deletion_requested',
        {
          email: userEmail,
          daysUntilDeletion: '30'
        },
        'urgent'
      )
      console.log(`✅ Data deletion request notification sent to user ${userId}`)
    } catch (error) {
      console.error('Error sending data deletion notification:', error)
    }
  }

  /**
   * Send data deletion completed notification
   */
  async notifyDataDeletionCompleted(userId: string, userEmail: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.send({
        userId,
        type: 'email',
        template: 'data_deletion_completed',
        data: {
          email: userEmail
        },
        priority: 'urgent'
      })
      console.log(`✅ Data deletion completed notification sent to user ${userId}`)
    } catch (error) {
      console.error('Error sending data deletion completed notification:', error)
    }
  }

  /**
   * Send driver registration approved notification
   */
  async notifyDriverRegistrationApproved(driverId: string, driverName: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email', 'sms'],
        'driver_registration_approved',
        {
          driverName
        },
        'urgent'
      )
      console.log(`✅ Driver registration approved notification sent to ${driverId}`)
    } catch (error) {
      console.error('Error sending driver registration approved notification:', error)
    }
  }

  /**
   * Send driver registration rejected notification
   */
  async notifyDriverRegistrationRejected(driverId: string, driverName: string, reason: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'driver_registration_rejected',
        {
          driverName,
          reason
        },
        'high'
      )
      console.log(`✅ Driver registration rejected notification sent to ${driverId}`)
    } catch (error) {
      console.error('Error sending driver registration rejected notification:', error)
    }
  }

  /**
   * Send bank details verified notification
   */
  async notifyBankDetailsVerified(driverId: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'bank_details_verified',
        {},
        'medium'
      )
      console.log(`✅ Bank details verified notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending bank details verified notification:', error)
    }
  }

  /**
   * Send bank details rejected notification
   */
  async notifyBankDetailsRejected(driverId: string, reason: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'bank_details_rejected',
        {
          reason
        },
        'medium'
      )
      console.log(`✅ Bank details rejected notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending bank details rejected notification:', error)
    }
  }

  /**
   * Send magazine activation notification
   */
  async notifyMagazineActivated(driverId: string, magazineTitle: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app'],
        'magazine_activated',
        {
          magazineTitle
        },
        'medium'
      )
      console.log(`✅ Magazine activated notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending magazine activation notification:', error)
    }
  }

  /**
   * Send invoice payment confirmed notification
   */
  async notifyInvoicePaymentConfirmed(advertiserId: string, invoiceNumber: string, amount: number): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        advertiserId,
        ['in_app', 'email'],
        'invoice_payment_confirmed',
        {
          invoiceNumber,
          amount: amount.toLocaleString()
        },
        'high'
      )
      console.log(`✅ Invoice payment confirmed notification sent to advertiser ${advertiserId}`)
    } catch (error) {
      console.error('Error sending invoice payment confirmed notification:', error)
    }
  }

  /**
   * Send KYC document verified notification
   */
  async notifyKycDocumentVerified(driverId: string, documentType: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'kyc_document_verified',
        {
          documentType
        },
        'medium'
      )
      console.log(`✅ KYC document verified notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending KYC document verified notification:', error)
    }
  }

  /**
   * Send KYC document rejected notification
   */
  async notifyKycDocumentRejected(driverId: string, documentType: string, reason: string): Promise<void> {
    try {
      const dispatcher = getNotificationDispatcher(this.payload)
      await dispatcher.sendMultiChannel(
        driverId,
        ['in_app', 'email'],
        'kyc_document_rejected',
        {
          documentType,
          reason
        },
        'high'
      )
      console.log(`✅ KYC document rejected notification sent to driver ${driverId}`)
    } catch (error) {
      console.error('Error sending KYC document rejected notification:', error)
    }
  }
}

/**
 * Helper function to get notification helpers instance
 */
export function getNotificationHelpers(payload: Payload): NotificationHelpers {
  return new NotificationHelpers(payload)
}


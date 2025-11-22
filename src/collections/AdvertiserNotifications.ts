import type { CollectionConfig } from 'payload'

export const AdvertiserNotifications: CollectionConfig = {
  slug: 'advertiser-notifications',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    read: ({ req: { user } }) => {
      if (user) return true
      return false
    },
    update: ({ req: { user } }) => {
      if (user) return true
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'advertiser',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
      admin: {
        description: 'Advertiser who will receive this notification',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Campaign Status', value: 'campaign_status' },
        { label: 'Creative Approval', value: 'creative_approval' },
        { label: 'Creative Rejection', value: 'creative_rejection' },
        { label: 'Invoice Payment', value: 'invoice_payment' },
        { label: 'Invoice Cancellation', value: 'invoice_cancellation' },
        { label: 'Support Response', value: 'support_response' },
        { label: 'Support Resolution', value: 'support_resolution' },
        { label: 'System Update', value: 'system' },
        { label: 'Payment', value: 'payment' },
        { label: 'General', value: 'general' }
      ],
      defaultValue: 'general',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Notification title',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Notification message content',
      },
    },
    {
      name: 'isRead',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the notification has been read',
      },
    },
    {
      name: 'actionUrl',
      type: 'text',
      admin: {
        description: 'URL to navigate to when notification is clicked',
      },
    },
    {
      name: 'priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' }
      ],
      defaultValue: 'medium',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'When this notification expires',
      },
    },
    {
      name: 'readAt',
      type: 'date',
      admin: {
        description: 'When the notification was read',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional notification metadata (campaignId, invoiceId, creativeId, etc.)',
      },
    },
    {
      name: 'campaignId',
      type: 'text',
      admin: {
        description: 'Related campaign ID',
      },
    },
    {
      name: 'campaignStatus',
      type: 'text',
      admin: {
        description: 'Campaign status (for campaign notifications)',
      },
    },
    {
      name: 'creativeId',
      type: 'text',
      admin: {
        description: 'Related creative ID',
      },
    },
    {
      name: 'creativeName',
      type: 'text',
      admin: {
        description: 'Creative file name',
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        description: 'Rejection reason (for rejected creatives/campaigns)',
      },
    },
    {
      name: 'invoiceId',
      type: 'text',
      admin: {
        description: 'Related invoice ID',
      },
    },
    {
      name: 'invoiceNumber',
      type: 'text',
      admin: {
        description: 'Invoice number',
      },
    },
    {
      name: 'amount',
      type: 'number',
      admin: {
        description: 'Amount (for invoice/payment notifications)',
      },
    },
    {
      name: 'ticketId',
      type: 'text',
      admin: {
        description: 'Related support ticket ID',
      },
    },
    {
      name: 'ticketNumber',
      type: 'text',
      admin: {
        description: 'Support ticket number',
      },
    },
  ],
}


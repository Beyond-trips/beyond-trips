import type { CollectionConfig } from 'payload'

export const DriverNotifications: CollectionConfig = {
  slug: 'driver-notifications',
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
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Driver who will receive this notification',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Payout', value: 'payout' },
        { label: 'Earnings Update', value: 'earnings' },
        { label: 'Magazine', value: 'magazine' },
        { label: 'Profile', value: 'profile' },
        { label: 'Rating Received', value: 'rating' },
        { label: 'Trip Update', value: 'trip' },
        { label: 'System Update', value: 'system' },
        { label: 'Payment', value: 'payment' },
        { label: 'Document', value: 'document' },
        { label: 'Training', value: 'training' },
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
        description: 'Additional notification metadata (payoutId, amount, magazineName, etc.)',
      },
    },
    {
      name: 'payoutId',
      type: 'text',
      admin: {
        description: 'Related payout ID (for payout notifications)',
      },
    },
    {
      name: 'amount',
      type: 'number',
      admin: {
        description: 'Amount (for earnings/payout notifications)',
      },
    },
    {
      name: 'payoutStatus',
      type: 'text',
      admin: {
        description: 'Payout status (for payout notifications)',
      },
    },
    {
      name: 'earningsAmount',
      type: 'number',
      admin: {
        description: 'Earnings amount (for earnings notifications)',
      },
    },
    {
      name: 'campaignId',
      type: 'text',
      admin: {
        description: 'Related campaign ID (for earnings notifications)',
      },
    },
    {
      name: 'magazineName',
      type: 'text',
      admin: {
        description: 'Magazine name (for magazine notifications)',
      },
    },
    {
      name: 'pickupLocation',
      type: 'text',
      admin: {
        description: 'Pickup location (for magazine notifications)',
      },
    },
    {
      name: 'dueDate',
      type: 'date',
      admin: {
        description: 'Due date (for magazine notifications)',
      },
    },
    {
      name: 'actionRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether action is required (for magazine notifications)',
      },
    },
    {
      name: 'profileField',
      type: 'text',
      admin: {
        description: 'Profile field name (for profile notifications)',
      },
    },
    {
      name: 'documentType',
      type: 'text',
      admin: {
        description: 'Document type (for profile notifications)',
      },
    },
    {
      name: 'verificationStatus',
      type: 'text',
      admin: {
        description: 'Verification status (for profile notifications)',
      },
    },
    {
      name: 'securityLevel',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
      ],
      admin: {
        description: 'Security level (for profile/security notifications)',
      },
    },
  ],
}

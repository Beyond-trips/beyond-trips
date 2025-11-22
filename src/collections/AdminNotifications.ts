import type { CollectionConfig } from 'payload'

export const AdminNotifications: CollectionConfig = {
  slug: 'admin-notifications',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'admin',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin user who will receive this notification (optional - can broadcast to all admins)',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Support Ticket', value: 'support_ticket' },
        { label: 'GDPR Request', value: 'gdpr_request' },
        { label: 'New Driver', value: 'new_driver' },
        { label: 'New Advertiser', value: 'new_advertiser' },
        { label: 'System Alert', value: 'system_alert' },
        { label: 'Driver Request', value: 'driver_request' },
        { label: 'Advertiser Request', value: 'advertiser_request' },
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
        description: 'Additional notification metadata',
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
    {
      name: 'userId',
      type: 'text',
      admin: {
        description: 'Related user ID (driver/advertiser)',
      },
    },
    {
      name: 'userEmail',
      type: 'text',
      admin: {
        description: 'Related user email',
      },
    },
    {
      name: 'requestType',
      type: 'text',
      admin: {
        description: 'Type of request (withdrawal, bank_update, etc.)',
      },
    },
  ],
}


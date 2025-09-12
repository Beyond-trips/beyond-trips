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
        { label: 'Earnings Update', value: 'earnings' },
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
  ],
}

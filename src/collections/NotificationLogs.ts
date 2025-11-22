// New file: src/collections/NotificationLogs.ts
import { CollectionConfig } from 'payload'

const NotificationLogs: CollectionConfig = {
  slug: 'notification-logs',
  admin: {
    useAsTitle: 'notificationId',
    defaultColumns: ['notificationId', 'channel', 'status', 'sentAt', 'attempts'],
    group: 'Notification Management',
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: () => true, // System can create logs
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'notificationId',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique identifier for the notification',
      },
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: [
        { label: 'Email', value: 'email' },
        { label: 'SMS', value: 'sms' },
        { label: 'Push', value: 'push' },
        { label: 'In-App', value: 'in_app' },
      ],
      admin: {
        description: 'Notification delivery channel',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Failed', value: 'failed' },
        { label: 'Bounced', value: 'bounced' },
      ],
      admin: {
        description: 'Current delivery status',
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm:ss',
        },
        description: 'When the notification was sent',
      },
    },
    {
      name: 'deliveredAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm:ss',
        },
        description: 'When the notification was delivered/confirmed',
      },
    },
    {
      name: 'failureReason',
      type: 'textarea',
      admin: {
        description: 'Reason for delivery failure',
        condition: (data) => data?.status === 'failed' || data?.status === 'bounced',
      },
    },
    {
      name: 'attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Number of delivery attempts',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional metadata about the delivery',
      },
    },
  ],
  timestamps: true,
}

export default NotificationLogs


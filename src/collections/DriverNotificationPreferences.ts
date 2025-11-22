import type { CollectionConfig } from 'payload'

export const DriverNotificationPreferences: CollectionConfig = {
  slug: 'driver-notification-preferences',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user) return true
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
      unique: true,
      admin: {
        description: 'Driver who owns these notification preferences',
      },
    },
    {
      name: 'emailNotifications',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable email notifications',
      },
    },
    {
      name: 'smsNotifications',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable SMS notifications',
      },
    },
    {
      name: 'pushNotifications',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable push notifications',
      },
    },
    {
      name: 'payoutAlerts',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Receive payout alerts',
      },
    },
    {
      name: 'earningsAlerts',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Receive earnings alerts',
      },
    },
    {
      name: 'magazineAlerts',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Receive magazine alerts',
      },
    },
    {
      name: 'profileAlerts',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Receive profile alerts',
      },
    },
  ],
}


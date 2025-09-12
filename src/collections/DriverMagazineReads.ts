import type { CollectionConfig } from 'payload'

export const DriverMagazineReads: CollectionConfig = {
  slug: 'driver-magazine-reads',
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
      admin: {
        description: 'Driver who read the magazine',
      },
    },
    {
      name: 'magazine',
      type: 'relationship',
      relationTo: 'driver-magazines',
      required: true,
      admin: {
        description: 'Magazine that was read',
      },
    },
    {
      name: 'isRead',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the magazine has been read',
      },
    },
    {
      name: 'readAt',
      type: 'date',
      admin: {
        description: 'When the magazine was read',
      },
    },
    {
      name: 'readProgress',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Reading progress percentage (0-100)',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Set readAt when isRead changes to true
        if (data.isRead && !data.readAt) {
          data.readAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}

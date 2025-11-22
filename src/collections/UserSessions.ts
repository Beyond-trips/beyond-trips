import type { CollectionConfig } from 'payload'

export const UserSessions: CollectionConfig = {
  slug: 'user-sessions',
  access: {
    create: ({ req: { user } }) => {
      // Users can create their own sessions
      return !!user
    },
    read: ({ req: { user } }) => {
      // Users can only read their own sessions
      if (!user) return false
      return {
        userId: {
          equals: user.id,
        },
      }
    },
    update: ({ req: { user } }) => {
      // Users can only update their own sessions
      if (!user) return false
      return {
        userId: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      // Users can delete their own sessions, admins can delete any
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        userId: {
          equals: user.id,
        },
      }
    },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['userId', 'device', 'ipAddress', 'loginTime', 'isActive'],
  },
  fields: [
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'sessionToken',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'userAgent',
      type: 'text',
    },
    {
      name: 'ipAddress',
      type: 'text',
      index: true,
    },
    {
      name: 'browser',
      type: 'text',
    },
    {
      name: 'os',
      type: 'text',
    },
    {
      name: 'device',
      type: 'text',
    },
    {
      name: 'country',
      type: 'text',
    },
    {
      name: 'city',
      type: 'text',
    },
    {
      name: 'loginTime',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
    },
    {
      name: 'lastActive',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
    },
    {
      name: 'logoutTime',
      type: 'date',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
    },
    {
      name: 'isCurrent',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
  ],
  indexes: [
    { fields: ['userId', 'isActive'] },
    { fields: ['sessionToken'] },
    { fields: ['userId', 'isCurrent'] },
  ],
}


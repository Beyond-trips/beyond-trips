import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    create: () => true, // Allow anyone to create users
    read: () => true,
    update: ({ req: { user } }) => {
      if (user) return true
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
  },
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'username',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'user'],
      defaultValue: 'user',
      required: true,
    },
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
    },
    // Add these OTP fields
    {
      name: 'otp',
      type: 'text',
      admin: {
        hidden: true, // Hide from admin UI for security
      },
    },
    {
      name: 'otpExpiry',
      type: 'date',
      admin: {
        hidden: true, // Hide from admin UI for security
      },
    },
  ],
}
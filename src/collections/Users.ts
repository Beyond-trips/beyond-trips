// collections/Users.ts
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
    // Basic Auth Fields
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
    
    // OTP Fields (for email verification)
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

    // === ONBOARDING PROFILE FIELDS ===
    // These will be filled during the onboarding process
    
    // Personal Information
    {
      name: 'firstName',
      type: 'text',
      admin: {
        description: 'Collected during onboarding',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      admin: {
        description: 'Collected during onboarding',
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
      admin: {
        description: 'Contact number collected during onboarding',
      },
    },
    {
      name: 'address',
      type: 'textarea',
      admin: {
        description: 'Home address collected during onboarding',
      },
    },

    
    {
      name: 'references',
      type: 'text',
      admin: {
        description: 'who referred user ',
      },
    },
    
  ],
}
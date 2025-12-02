// collections/Users.ts
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    create: () => true, // Allow anyone to create users
    read: () => true,
    update: ({ req: { user }, id }) => {
      // Admins can update any user (including unlocking accounts)
      if (user?.role === 'admin') return true
      // Users can only update themselves
      if (user) return { id: { equals: user.id } }
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
      options: ['admin', 'user'      ],
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

    // Password Reset Fields
    {
      name: 'passwordResetToken',
      type: 'text',
      admin: {
        hidden: true, // Hide from admin UI for security
      },
    },
    {
      name: 'passwordResetExpiry',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'passwordChangedAt',
      type: 'date',
      admin: {
        readOnly: true,
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
        description: 'who referred user',
      },
    },
    
    // Notification Preferences
    {
      name: 'notificationPreferences',
      type: 'group',
      label: 'Notification Preferences',
      fields: [
        {
          name: 'email_enabled',
          type: 'checkbox',
          label: 'Email Notifications',
          defaultValue: true,
          admin: {
            description: 'Receive notifications via email',
          },
        },
        {
          name: 'sms_enabled',
          type: 'checkbox',
          label: 'SMS Notifications',
          defaultValue: false,
          admin: {
            description: 'Receive notifications via SMS',
          },
        },
        {
          name: 'in_app_enabled',
          type: 'checkbox',
          label: 'In-App Notifications',
          defaultValue: true,
          admin: {
            description: 'Receive in-app notifications',
          },
        },
        {
          name: 'notification_types',
          type: 'select',
          label: 'Notification Types',
          hasMany: true,
          defaultValue: ['payment', 'campaign', 'magazine', 'system'],
          options: [
            {
              label: 'Payment Notifications',
              value: 'payment',
            },
            {
              label: 'Campaign Notifications',
              value: 'campaign',
            },
            {
              label: 'Magazine Notifications',
              value: 'magazine',
            },
            {
              label: 'System Notifications',
              value: 'system',
            },
          ],
          admin: {
            description: 'Types of notifications to receive',
          },
        },
      ],
    },
  ],
}
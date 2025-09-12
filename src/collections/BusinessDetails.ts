import type { CollectionConfig } from 'payload'

export const BusinessDetails: CollectionConfig = {
  slug: 'business-details',
  admin: {
    useAsTitle: 'companyName',
  },
  fields: [
    {
      name: 'companyEmail',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'password',
      type: 'text',
      required: true,
      // In production, this should be hashed
    },
    {
      name: 'companyName',
      type: 'text',
      required: true,
    },
    {
      name: 'companyAddress',
      type: 'textarea',
      required: true,
    },
    {
      name: 'contact',
      type: 'text',
      required: true,
    },
    {
      name: 'industry',
      type: 'text',
      required: true,
    },
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'verificationCode',
      type: 'text',
      admin: {
        hidden: true, // Hide from admin UI
      },
    },
    {
      name: 'registrationStatus',
      type: 'select',
      options: ['pending', 'email_verified', 'campaign_setup', 'payment_setup', 'completed'],
      defaultValue: 'pending',
    },
    {
      name: 'registrationDate',
      type: 'date',
      defaultValue: () => new Date(),
    },
    {
      name: 'lastLogin',
      type: 'date',
    },
    {
      name: 'lastLogout', 
      type: 'date',
    },
    {
      name: 'passwordResetToken',
      type: 'text',
    },
    {
      name: 'passwordResetExpiry',
      type: 'date',
    },
    {
      name: 'passwordChangedAt',
      type: 'date',
    },
    {
      name: 'verificationCodeExpiry',
      type: 'date',
      defaultValue: () => new Date(),
    },
    {
      name: 'profilePicture',
      type: 'text',
      admin: {
        description: 'URL to the business profile picture',
      },
    },
    {
      name: 'profilePictureUpdatedAt',
      type: 'date',
      admin: {
        description: 'When the profile picture was last updated',
      },
    },
    {
      name: 'profilePictureId',
      type: 'relationship',
      relationTo: 'profile-pictures',
      admin: {
        description: 'Reference to the ProfilePictures collection',
      },
    },

  ],
}

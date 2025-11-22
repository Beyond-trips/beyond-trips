import type { CollectionConfig } from 'payload'

export const DriverRatings: CollectionConfig = {
  slug: 'driver-ratings',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: () => true, // Allow public (unauthenticated) submissions
    read: ({ req: { user } }) => {
      if (user) return true // Authenticated users can read
      return true // Public can also read ratings
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'driver') return true // Drivers can respond to reviews
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
        description: 'Driver being rated',
      },
    },
    {
      name: 'raterName',
      type: 'text',
      admin: {
        description: 'Name of the person who gave the rating (for unauthenticated riders)',
      },
    },
    {
      name: 'raterEmail',
      type: 'email',
      admin: {
        description: 'Email of the person who gave the rating (optional)',
      },
    },
    {
      name: 'raterPhone',
      type: 'text',
      admin: {
        description: 'Phone number of the rider (optional, for verification)',
      },
    },
    {
      name: 'deviceFingerprint',
      type: 'text',
      admin: {
        description: 'Device fingerprint to prevent duplicate ratings from same device',
      },
    },
    {
      name: 'rating',
      type: 'number',
      min: 1,
      max: 5,
      required: true,
      admin: {
        description: 'Rating from 1 to 5 stars',
      },
    },
    {
      name: 'review',
      type: 'textarea',
      admin: {
        description: 'Written review/feedback',
      },
    },
    {
      name: 'tripId',
      type: 'text',
      admin: {
        description: 'Trip ID if applicable',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Overall Experience', value: 'overall' },
        { label: 'Punctuality', value: 'punctuality' },
        { label: 'Vehicle Condition', value: 'vehicle' },
        { label: 'Communication', value: 'communication' },
        { label: 'Safety', value: 'safety' },
        { label: 'Friendliness', value: 'friendliness' }
      ],
      defaultValue: 'overall',
      required: true,
    },
    {
      name: 'isVerified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this rating is verified',
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this rating is public',
      },
    },
    {
      name: 'response',
      type: 'textarea',
      admin: {
        description: 'Driver response to the rating',
      },
    },
    {
      name: 'respondedAt',
      type: 'date',
      admin: {
        description: 'When the driver responded',
      },
    },
    {
      name: 'isModerated',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this rating has been reviewed by admin',
      },
    },
    {
      name: 'moderatedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who moderated this rating',
      },
    },
    {
      name: 'moderationNotes',
      type: 'textarea',
      admin: {
        description: 'Admin notes on moderation',
      },
    },
    {
      name: 'magazineBarcode',
      type: 'text',
      admin: {
        description: 'Magazine barcode scanned by rider (links review to BTL coin system)',
      },
    },
    {
      name: 'btlCoinAwarded',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether a BTL coin was awarded for this review',
      },
    },
    {
      name: 'scanTimestamp',
      type: 'date',
      admin: {
        description: 'When the rider scanned the magazine barcode',
      },
    },
  ],
}

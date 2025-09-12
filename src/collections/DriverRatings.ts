import type { CollectionConfig } from 'payload'

export const DriverRatings: CollectionConfig = {
  slug: 'driver-ratings',
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
      if (user?.role === 'admin') return true
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
      name: 'rater',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who gave the rating',
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
  ],
}

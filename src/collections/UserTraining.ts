import type { CollectionConfig } from 'payload'

export const UserTraining: CollectionConfig = {
  slug: 'user-training',
  admin: {
    useAsTitle: 'userId',
  },
  fields: [
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'trainingVideos',
      type: 'array',
      fields: [
        {
          name: 'videoId',
          type: 'text',
          required: true,
        },
        {
          name: 'videoTitle',
          type: 'text',
          required: true,
        },
        {
          name: 'completed',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'completedAt',
          type: 'date',
        },
        {
          name: 'watchTime',
          type: 'number',
          admin: {
            description: 'Watch time in seconds',
          },
        },
      ],
    },
    {
      name: 'termsAccepted',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'termsAcceptedAt',
      type: 'date',
    },
    {
      name: 'trainingCompleted',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'trainingCompletedAt',
      type: 'date',
    },
  ],
}
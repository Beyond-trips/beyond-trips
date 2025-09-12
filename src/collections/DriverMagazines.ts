import type { CollectionConfig } from 'payload'

export const DriverMagazines: CollectionConfig = {
  slug: 'driver-magazines',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    read: () => true,
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
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Magazine title',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Magazine description',
      },
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description: 'Magazine content',
      },
    },
    {
      name: 'imageUrl',
      type: 'text',
      admin: {
        description: 'Magazine cover image URL',
      },
    },
    {
      name: 'readTime',
      type: 'number',
      min: 1,
      admin: {
        description: 'Estimated read time in minutes',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Tips', value: 'tips' },
        { label: 'Safety', value: 'safety' },
        { label: 'Earnings', value: 'earnings' },
        { label: 'Community', value: 'community' },
        { label: 'Updates', value: 'updates' }
      ],
      defaultValue: 'news',
      required: true,
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this magazine is published',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        description: 'When this magazine was published',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
      admin: {
        description: 'Tags for categorization',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Set publishedAt when isPublished changes to true
        if (data.isPublished && !data.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}

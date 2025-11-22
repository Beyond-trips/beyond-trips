import type { CollectionConfig } from 'payload'

export const CampaignPerformance: CollectionConfig = {
  slug: 'campaign-performance',
  admin: {
    useAsTitle: 'date',
  },
  fields: [
    {
      name: 'campaignId',
      type: 'relationship',
      relationTo: 'ad-campaigns',
      required: true,
    },
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
    },
    {
      name: 'impressions',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'clicks',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'conversions',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'spend',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'engagementRate',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
    },
    {
      name: 'clickThroughRate',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
    },
    {
      name: 'conversionRate',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
    },
    {
      name: 'costPerClick',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'costPerConversion',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  access: {
    create: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    read: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin'
    },
    delete: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
}

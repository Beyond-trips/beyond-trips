// collections/AnalyticsData.ts
import type { CollectionConfig } from 'payload'

export const AnalyticsData: CollectionConfig = {
  slug: 'analytics-data',
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
      name: 'costPerMille',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'currency',
      type: 'select',
      options: [
        { label: 'Nigerian Naira', value: 'NGN' },
        { label: 'US Dollar', value: 'USD' },
        { label: 'Euro', value: 'EUR' },
      ],
      defaultValue: 'NGN',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Magazine', value: 'magazine' },
        { label: 'Digital', value: 'digital' },
        { label: 'QR Code', value: 'qr_code' },
        { label: 'Social Media', value: 'social_media' },
        { label: 'Email', value: 'email' },
      ],
      defaultValue: 'magazine',
    },
    {
      name: 'deviceType',
      type: 'select',
      options: [
        { label: 'Desktop', value: 'desktop' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Tablet', value: 'tablet' },
        { label: 'All', value: 'all' },
      ],
      defaultValue: 'all',
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'Geographic location (e.g., Lagos, Abuja)',
      },
    },
    {
      name: 'ageGroup',
      type: 'select',
      options: [
        { label: '18-24', value: '18-24' },
        { label: '25-34', value: '25-34' },
        { label: '35-44', value: '35-44' },
        { label: '45-54', value: '45-54' },
        { label: '55+', value: '55+' },
        { label: 'All', value: 'all' },
      ],
      defaultValue: 'all',
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'All', value: 'all' },
      ],
      defaultValue: 'all',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes or comments about this analytics data',
      },
    },
  ],
  access: {
    create: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'partner' || user.role === 'user'
    },
    read: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'partner'
    },
    delete: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Calculate engagement rate (clicks / impressions * 100)
        if (data.impressions && data.clicks) {
          data.engagementRate = Math.round((data.clicks / data.impressions) * 100 * 100) / 100
        }
        
        // Calculate click-through rate (same as engagement rate for now)
        data.clickThroughRate = data.engagementRate
        
        // Calculate conversion rate (conversions / clicks * 100)
        if (data.clicks && data.conversions) {
          data.conversionRate = Math.round((data.conversions / data.clicks) * 100 * 100) / 100
        }
        
        // Calculate cost per click (spend / clicks)
        if (data.clicks && data.spend) {
          data.costPerClick = Math.round((data.spend / data.clicks) * 100) / 100
        }
        
        // Calculate cost per conversion (spend / conversions)
        if (data.conversions && data.spend) {
          data.costPerConversion = Math.round((data.spend / data.conversions) * 100) / 100
        }
        
        // Calculate cost per mille (spend / impressions * 1000)
        if (data.impressions && data.spend) {
          data.costPerMille = Math.round((data.spend / data.impressions) * 1000 * 100) / 100
        }
      },
    ],
  },
}

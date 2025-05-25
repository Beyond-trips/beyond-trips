import type { CollectionConfig } from 'payload'

export const AdCampaigns: CollectionConfig = {
  slug: 'ad-campaigns',
  admin: {
    useAsTitle: 'campaignType',
  },
  fields: [
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'campaignType',
      type: 'select',
      options: [
        { label: 'Magazine', value: 'magazine' },
        { label: 'Digital', value: 'digital' },
        { label: 'QR Engagement', value: 'qr_engagement' }
      ],
      required: true,
    },
    {
      name: 'campaignName',
      type: 'text',
    },
    {
      name: 'campaignDescription',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'active', 'paused', 'completed'],
      defaultValue: 'draft',
    },
    {
      name: 'createdAt',
      type: 'date',
      defaultValue: () => new Date(),
    },
  ],
}

import type { CollectionConfig } from 'payload'

export const CampaignMedia: CollectionConfig = {
  slug: 'campaign-media',
  admin: {
    useAsTitle: 'fileName',
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
      name: 'fileName',
      type: 'text',
      required: true,
    },
    {
      name: 'fileType',
      type: 'select',
      options: [
        { label: 'PDF', value: 'pdf' },
        { label: 'JPEG', value: 'jpeg' },
        { label: 'PNG', value: 'png' },
        { label: 'GIF', value: 'gif' },
        { label: 'MP4', value: 'mp4' },
        { label: 'Other', value: 'other' }
      ],
      required: true,
    },
    {
      name: 'fileUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'fileSize',
      type: 'number',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'uploadStatus',
      type: 'select',
      options: [
        { label: 'Uploading', value: 'uploading' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' }
      ],
      defaultValue: 'uploading',
    },
    {
      name: 'isApproved',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'approvedAt',
      type: 'date',
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
    },
    {
      name: 'uploadedAt',
      type: 'date',
      defaultValue: () => new Date(),
    },
  ],
  access: {
    create: ({ req: { user } }: any) => {
      if (!user) return false
      // Allow both Payload CMS users and partners
      return user.role === 'admin' || user.role === 'partner' || user.role === 'user'
    },
    read: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    delete: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
  },
}

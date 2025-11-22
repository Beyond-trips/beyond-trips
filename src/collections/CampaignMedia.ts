import type { CollectionConfig } from 'payload'

export const CampaignMedia: CollectionConfig = {
  slug: 'campaign-media',
  admin: {
    useAsTitle: 'id', // Changed from 'fileName' since we removed that field
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
      name: 'mediaFile',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: '✅ Media file from Media collection (preferred - automatically uploads to S3)',
      },
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
      name: 'approvalStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' }
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        description: 'Creative approval status',
      },
    },
    {
      name: 'isApproved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Legacy field - use approvalStatus instead',
        readOnly: true,
      },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who approved/rejected this creative',
        readOnly: true,
      },
    },
    {
      name: 'approvedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when creative was approved',
        readOnly: true,
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        description: 'Reason for creative rejection (shown to advertiser)',
        condition: (data) => data?.approvalStatus === 'rejected',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        description: 'Internal admin notes about this creative',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
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

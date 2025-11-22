import type { CollectionConfig } from 'payload'

export const AdCampaigns: CollectionConfig = {
  slug: 'ad-campaigns',
  admin: {
    useAsTitle: 'campaignName',
  },
  fields: [
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'campaignName',
      type: 'text',
      required: true,
    },
    {
      name: 'campaignDescription',
      type: 'textarea',
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
      name: 'magazine',
      type: 'relationship',
      relationTo: 'driver-magazines',
      admin: {
        description: 'Linked magazine edition (auto-linked when admin creates new magazine)',
        condition: (data: any) => data.campaignType === 'magazine',
      },
    },
    {
      name: 'budget',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'budgetSpent',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'targetAudience',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Pending Review', value: 'pending_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Rejected', value: 'rejected' }
      ],
      defaultValue: 'draft',
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
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      access: {
        create: ({ req: { user } }: any) => {
          if (!user) return false
          return user.role === 'admin'
        },
        update: ({ req: { user } }: any) => {
          if (!user) return false
          return user.role === 'admin'
        },
      },
    },
    {
      name: 'reviewedAt',
      type: 'date',
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    // QR Engagement Campaign fields
    {
      name: 'enableQRCampaign',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable QR code generation for this campaign',
        condition: (data: any) => data.campaignType === 'qr_engagement',
      },
    },
    {
      name: 'qrCode',
      type: 'relationship',
      relationTo: 'advertiser-qr-codes',
      admin: {
        description: 'Generated QR code for this campaign',
        condition: (data: any) => data.enableQRCampaign === true,
      },
    },
    {
      name: 'promoTitle',
      type: 'text',
      admin: {
        description: 'Title of promotional offer (e.g., "40% Hotel Discount")',
        condition: (data: any) => data.enableQRCampaign === true,
      },
    },
    {
      name: 'promoDescription',
      type: 'textarea',
      admin: {
        description: 'Description of the offer',
        condition: (data: any) => data.enableQRCampaign === true,
      },
    },
    {
      name: 'promoLink',
      type: 'text',
      admin: {
        description: 'URL where users redeem the offer',
        condition: (data: any) => data.enableQRCampaign === true,
      },
    },
    {
      name: 'promoTerms',
      type: 'textarea',
      admin: {
        description: 'Terms and conditions',
        condition: (data: any) => data.enableQRCampaign === true,
      },
    },
    // Status tracking fields
    {
      name: 'pausedAt',
      type: 'date',
    },
    {
      name: 'pauseReason',
      type: 'textarea',
    },
    {
      name: 'resumedAt',
      type: 'date',
    },
    {
      name: 'resumeReason',
      type: 'textarea',
    },
    {
      name: 'cancelledAt',
      type: 'date',
    },
    {
      name: 'cancelReason',
      type: 'textarea',
    },
    {
      name: 'refundAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'lastStatusChange',
      type: 'date',
    },
    {
      name: 'createdAt',
      type: 'date',
      defaultValue: () => new Date(),
    },
    {
      name: 'updatedAt',
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
      return user.role === 'admin'
    },
  },
}

import type { CollectionConfig } from 'payload'

export const AdvertiserQRCodes: CollectionConfig = {
  slug: 'advertiser-qr-codes',
  admin: {
    useAsTitle: 'qrCode',
    defaultColumns: ['qrCode', 'campaign', 'scansCount', 'status', 'createdAt'],
  },
  access: {
    create: ({ req: { user } }) => {
      // Only admins and advertisers can create QR codes
      if (user?.role === 'admin') return true
      if (user?.role === 'partner') return true // Partners/Advertisers
      return false
    },
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true // Admins see all
      if (user?.role === 'partner') {
        // Partners only see their own campaign QR codes
        return {
          'campaign.advertiser': {
            equals: user.id,
          },
        }
      }
      return true // Public can read to validate QR codes
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'partner') return true
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'campaign',
      type: 'relationship',
      relationTo: 'ad-campaigns',
      required: true,
      admin: {
        description: 'Campaign this QR code belongs to',
      },
    },
    {
      name: 'qrCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique QR code identifier (e.g., ADV-HOTEL-2025-001)',
      },
    },
    {
      name: 'qrImageUrl',
      type: 'text',
      admin: {
        description: 'S3 URL for the QR code image (preferred over base64)',
      },
    },
    {
      name: 'qrImageData',
      type: 'textarea',
      admin: {
        description: 'Base64 encoded QR code image data (legacy - use qrImageUrl instead)',
      },
    },
    {
      name: 'promoTitle',
      type: 'text',
      required: true,
      admin: {
        description: 'Title of the promotional offer (e.g., "40% Hotel Discount")',
      },
    },
    {
      name: 'promoDescription',
      type: 'textarea',
      admin: {
        description: 'Description of what the user gets',
      },
    },
    {
      name: 'promoLink',
      type: 'text',
      required: true,
      admin: {
        description: 'URL where user is redirected to redeem offer',
      },
    },
    {
      name: 'promoTerms',
      type: 'textarea',
      admin: {
        description: 'Terms and conditions of the offer',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'When the QR code/offer expires',
      },
    },
    {
      name: 'scansCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Total number of times this QR code was scanned',
      },
    },
    {
      name: 'uniqueScansCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Number of unique devices that scanned this QR',
      },
    },
    {
      name: 'redemptionsCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Number of successful redemptions',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Expired', value: 'expired' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      required: true,
      admin: {
        description: 'Current status of the QR code',
      },
    },
    {
      name: 'maxScans',
      type: 'number',
      admin: {
        description: 'Maximum number of scans allowed (optional limit)',
      },
    },
    {
      name: 'conversionRate',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        description: 'Percentage of scans that led to redemptions',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Calculate conversion rate
        if (data.scansCount > 0) {
          data.conversionRate = ((data.redemptionsCount / data.scansCount) * 100).toFixed(2)
        } else {
          data.conversionRate = 0
        }

        // Auto-expire if past expiration date
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          data.status = 'expired'
        }

        // Check if max scans reached
        if (data.maxScans && data.scansCount >= data.maxScans) {
          data.status = 'inactive'
        }

        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['qrCode'],
      unique: true,
    },
    {
      fields: ['campaign'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['createdAt'],
    },
  ],
}

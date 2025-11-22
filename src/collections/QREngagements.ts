import type { CollectionConfig } from 'payload'

export const QREngagements: CollectionConfig = {
  slug: 'qr-engagements',
  admin: {
    useAsTitle: 'redemptionCode',
    defaultColumns: ['qrCode', 'deviceId', 'status', 'scannedAt'],
  },
  access: {
    create: () => true, // Public endpoint can create engagements
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true // Admins see all
      if (user?.role === 'partner') {
        // Partners only see engagements for their campaigns
        return {
          'qrCode.campaign.advertiser': {
            equals: user.id,
          },
        }
      }
      return false // Public cannot read engagement data
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
      name: 'qrCode',
      type: 'relationship',
      relationTo: 'advertiser-qr-codes',
      required: true,
      admin: {
        description: 'QR code that was scanned',
      },
    },
    {
      name: 'deviceId',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique device identifier (from browser fingerprint/localStorage)',
      },
    },
    {
      name: 'scannedAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Timestamp when QR code was scanned',
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      admin: {
        description: 'IP address of the device that scanned',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'Browser/device user agent string',
      },
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'city',
          type: 'text',
        },
        {
          name: 'region',
          type: 'text',
        },
        {
          name: 'country',
          type: 'text',
        },
        {
          name: 'latitude',
          type: 'number',
        },
        {
          name: 'longitude',
          type: 'number',
        },
      ],
      admin: {
        description: 'Geographic location data (optional)',
      },
    },
    {
      name: 'redemptionCode',
      type: 'text',
      unique: true,
      admin: {
        description: 'Unique redemption code generated for this scan',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Scanned', value: 'scanned' },
        { label: 'Redeemed', value: 'redeemed' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Failed', value: 'failed' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'scanned',
      required: true,
      admin: {
        description: 'Status of the engagement',
      },
    },
    {
      name: 'redeemedAt',
      type: 'date',
      admin: {
        description: 'When the offer was redeemed',
      },
    },
    {
      name: 'reason',
      type: 'textarea',
      admin: {
        description: 'Reason if scan was rejected (duplicate, failed, expired)',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional metadata (device type, referrer, etc.)',
      },
    },
    {
      name: 'magazineBarcode',
      type: 'text',
      admin: {
        description: 'Magazine barcode if QR code was scanned from a magazine',
      },
    },
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Driver whose magazine was scanned (if applicable)',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Set scannedAt on creation
        if (operation === 'create' && !data.scannedAt) {
          data.scannedAt = new Date()
        }

        // Set redeemedAt when status changes to redeemed
        if (data.status === 'redeemed' && !data.redeemedAt) {
          data.redeemedAt = new Date()
        }

        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['qrCode', 'deviceId'], // Prevent duplicate scans
    },
    {
      fields: ['deviceId'],
    },
    {
      fields: ['redemptionCode'],
      unique: true,
    },
    {
      fields: ['scannedAt'],
    },
    {
      fields: ['status'],
    },
  ],
}

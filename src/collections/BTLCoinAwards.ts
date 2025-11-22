import type { CollectionConfig } from 'payload'

export const BTLCoinAwards: CollectionConfig = {
  slug: 'btl-coin-awards',
  admin: {
    useAsTitle: 'id',
    description: 'BTL Coin awards for driver engagement from rider interactions',
  },
  access: {
    create: () => true, // System can create awards automatically
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'driver') {
        // Drivers can only see their own awards
        return {
          driver: {
            equals: user.id,
          },
        }
      }
      return false
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
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Driver who received the BTL coin',
      },
    },
    {
      name: 'magazine',
      type: 'relationship',
      relationTo: 'driver-magazines',
      required: true,
      admin: {
        description: 'Magazine edition that was scanned',
      },
    },
    {
      name: 'magazineBarcode',
      type: 'text',
      required: true,
      admin: {
        description: 'Barcode that was scanned by the rider',
      },
    },
    {
      name: 'review',
      type: 'relationship',
      relationTo: 'driver-ratings',
      admin: {
        description: 'Review submitted by the rider',
      },
    },
    {
      name: 'riderDeviceId',
      type: 'text',
      admin: {
        description: 'Device fingerprint of the rider (for tracking)',
      },
    },
    {
      name: 'riderName',
      type: 'text',
      admin: {
        description: 'Name of the rider who submitted the review',
      },
    },
    {
      name: 'amount',
      type: 'number',
      defaultValue: 1,
      required: true,
      admin: {
        description: 'Number of BTL coins awarded (always 1)',
      },
    },
    {
      name: 'earningRecord',
      type: 'relationship',
      relationTo: 'driver-earnings',
      admin: {
        description: 'Driver earning record created for this BTL coin',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Awarded', value: 'awarded' },
        { label: 'Processed', value: 'processed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'awarded',
      required: true,
    },
    {
      name: 'awardedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the BTL coin was awarded',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes or context',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // Ensure amount is always 1
        if (data.amount !== 1) {
          data.amount = 1
        }
        
        // Set awardedAt if not provided
        if (!data.awardedAt) {
          data.awardedAt = new Date().toISOString()
        }
        
        return data
      },
    ],
  },
}



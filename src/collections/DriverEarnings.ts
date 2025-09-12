import type { CollectionConfig } from 'payload'

export const DriverEarnings: CollectionConfig = {
  slug: 'driver-earnings',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return true // Allow drivers to create their own earnings
      return false
    },
    read: ({ req: { user } }) => {
      if (user) return true
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
        description: 'Driver who earned this amount',
      },
    },
    {
      name: 'scans',
      type: 'number',
      min: 0,
      required: true,
      admin: {
        description: 'Number of scans completed',
      },
    },
    {
      name: 'points',
      type: 'number',
      min: 0,
      required: true,
      admin: {
        description: 'Points earned (1 scan = 1 point)',
      },
    },
    {
      name: 'amount',
      type: 'number',
      min: 0,
      required: true,
      admin: {
        description: 'Earnings amount (points × 500 Naira)',
      },
    },
    {
      name: 'currency',
      type: 'select',
      options: [
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
        { label: 'GBP', value: 'GBP' },
        { label: 'NGN', value: 'NGN' }
      ],
      defaultValue: { value: 'NGN' },
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Scan Payment', value: 'scan_payment' },
        { label: 'Trip Payment', value: 'trip_payment' },
        { label: 'Bonus', value: 'bonus' },
        { label: 'Referral', value: 'referral' },
        { label: 'Incentive', value: 'incentive' },
        { label: 'Other', value: 'other' }
      ],
      defaultValue: { value: 'scan_payment' },
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' }
      ],
      defaultValue: { value: 'pending' },
      required: true,
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Description of the earnings',
      },
    },
    {
      name: 'tripId',
      type: 'text',
      admin: {
        description: 'Trip ID if applicable',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: {
        description: 'Date when payment was made',
      },
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Mobile Money', value: 'mobile_money' },
        { label: 'Cash', value: 'cash' },
        { label: 'Other', value: 'other' }
      ],
      admin: {
        description: 'Payment method used',
      },
    },
    {
      name: 'transactionId',
      type: 'text',
      admin: {
        description: 'Transaction reference ID',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Calculate points and amount based on scans
        if (data.scans && data.scans > 0) {
          data.points = data.scans // 1 scan = 1 point
          data.amount = data.scans * 500 // 500 Naira per point
          data.currency = 'NGN' // Default to Naira
        }
        
        // Set paidAt when status changes to paid
        if (data.status === 'paid' && !data.paidAt) {
          data.paidAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}

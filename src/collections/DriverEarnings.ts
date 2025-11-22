import type { CollectionConfig } from 'payload'

/**
 * DriverEarnings Collection
 * 
 * Tracks all driver earnings including:
 * - BTL coins (from rider interactions) - PRIMARY AUTOMATIC REWARD
 * - Admin bonuses (referrals, incentives, manual bonuses)
 * - Historical scan earnings (kept for audit purposes)
 * 
 * NOTE: QR code scans no longer create earnings automatically.
 * New earnings are only created from:
 * 1. BTL coins when riders submit reviews (₦500 per review)
 * 2. Admin manual bonuses/referrals/incentives
 * 
 * Historical earnings with source 'scan' remain in database.
 */
export const DriverEarnings: CollectionConfig = {
  slug: 'driver-earnings',
  admin: {
    useAsTitle: 'id',
    description: 'Driver earnings from BTL coins and admin bonuses',
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
      defaultValue: 'NGN',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Scan Payment (Deprecated)', value: 'scan_payment' }, // Kept for historical data only
        { label: 'Trip Payment', value: 'trip_payment' },
        { label: 'Bonus', value: 'bonus' },
        { label: 'Referral', value: 'referral' },
        { label: 'Incentive', value: 'incentive' },
        { label: 'Other', value: 'other' }
      ],
      defaultValue: 'bonus', // Changed from scan_payment since scans no longer create earnings
      required: true,
      admin: {
        description: 'Type of earnings (scan_payment is deprecated - no longer created)',
      },
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Magazine Scan (Deprecated)', value: 'scan' }, // Kept for historical data only
        { label: 'BTL Coin Reward', value: 'btl_coin' }, // Primary automatic reward
        { label: 'Trip', value: 'trip' },
        { label: 'Other', value: 'other' }
      ],
      defaultValue: 'btl_coin', // Changed from scan - BTL coins are now primary reward
      admin: {
        description: 'Source of the earnings (BTL coin = primary, scan = deprecated/historical only)',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' }
      ],
      defaultValue: 'active',
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

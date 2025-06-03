// collections/PaymentBudgeting.ts
import type { CollectionConfig } from 'payload'

export const PaymentBudgeting: CollectionConfig = {
  slug: 'payment-budgeting',
  admin: {
    useAsTitle: 'pricingTier',
  },
  fields: [
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'pricingTier',
      type: 'select',
      options: [
        { label: 'Starter - ₦0.00/month', value: 'starter' },
        { label: 'Standard - ₦0.00/month', value: 'standard' },
        { label: 'Pro - ₦0.00/month', value: 'pro' }
      ],
      required: true,
    },
    {
      name: 'monthlyBudget',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Card', value: 'card' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Mobile Money', value: 'mobile_money' }
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' }
      ],
      defaultValue: 'pending',
    },
    {
      name: 'subscriptionStartDate',
      type: 'date',
    },
    {
      name: 'nextBillingDate',
      type: 'date',
    },
  ],
}
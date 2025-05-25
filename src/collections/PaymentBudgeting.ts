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
        { label: 'Starter - N0.00/month', value: 'starter' },
        { label: 'Standard - N0.00/month', value: 'standard' },
        { label: 'Pro - N0.00/month', value: 'pro' }
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
      options: ['card', 'bank_transfer', 'mobile_money'],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: ['pending', 'completed', 'failed'],
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

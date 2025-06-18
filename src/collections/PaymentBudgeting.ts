// collections/PaymentBudgeting.ts
import type { CollectionConfig } from 'payload'

export const PaymentBudgeting: CollectionConfig = {
  slug: 'payment-budgeting',
  admin: {
    useAsTitle: 'selectedPlan',
  },
  fields: [
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'selectedPlan',
      type: 'text',
      required: true,
    },
  ],
}
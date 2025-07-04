// collections/SubscriptionPlans.ts
import type { CollectionConfig } from 'payload'

export const SubscriptionPlans: CollectionConfig = {
  slug: 'subscription-plans',
  defaultSort: ['price'],
  admin: {
    useAsTitle: 'planName',
  },
  access: {
    create: () => true, // Simplified for now
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'planName',
      type: 'text',
      required: true,
    },
    {
      name: 'planType',
      type: 'select',
      options: [
        { label: 'Starter', value: 'Starter' },
        { label: 'Standard', value: 'Standard' },
        { label: 'Pro', value: 'Pro' },
      ],
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      admin: {
        description: 'Price in your currency (e.g., NGN)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'NGN',
    },
    {
      name: 'billingCycle',
      type: 'select',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ],
      defaultValue: 'monthly',
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Plan description',
      },
    },
    {
      name: 'features',
      type: 'array',
      fields: [
        {
          name: 'feature',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}

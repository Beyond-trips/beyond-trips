// collections/PaymentBudgeting.ts
import type { CollectionConfig } from 'payload'

export const PaymentBudgeting: CollectionConfig = {
  slug: 'payment-budgeting',
  admin: {
    useAsTitle: 'paymentReference',
  },
  fields: [
    {
      name: 'businessId',
      type: 'relationship',
      relationTo: 'business-details',
      required: true,
    },
    {
      name: 'campaignId',
      type: 'relationship',
      relationTo: 'ad-campaigns',
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'NGN',
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Card', value: 'card' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'USSD', value: 'ussd' },
        { label: 'QR Code', value: 'qr_code' }
      ],
      defaultValue: 'card',
    },
    {
      name: 'customerEmail',
      type: 'email',
      required: true,
    },
    {
      name: 'customerName',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'paymentReference',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'paystackReference',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Successful', value: 'successful' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' }
      ],
      defaultValue: 'pending',
    },
    {
      name: 'paidAt',
      type: 'date',
    },
    {
      name: 'paystackResponse',
      type: 'json',
    },
    {
      name: 'selectedPlan',
      type: 'text',
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
      return user.role === 'admin' || user.role === 'partner'
    },
    read: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'partner'
    },
    delete: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
}
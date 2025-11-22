import type { CollectionConfig } from 'payload'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  fields: [
    {
      name: 'invoiceNumber',
      type: 'text',
      required: true,
      unique: true,
    },
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
      name: 'stripePaymentIntentId',
      type: 'text',
      required: true,
    },
    {
      name: 'stripeSessionId',
      type: 'text',
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'select',
      options: [
        { label: 'Nigerian Naira', value: 'NGN' },
        { label: 'US Dollar', value: 'USD' },
        { label: 'Euro', value: 'EUR' }
      ],
      defaultValue: 'NGN',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Pending Payment', value: 'pending_payment' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Cancelled', value: 'cancelled' }
      ],
      defaultValue: 'draft',
      required: true,
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' }
      ],
      defaultValue: 'pending',
    },
    {
      name: 'dueDate',
      type: 'date',
      required: true,
    },
    {
      name: 'paidAt',
      type: 'date',
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'description',
          type: 'text',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'total',
          type: 'number',
          required: true,
          min: 0,
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'taxRate',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
    },
    {
      name: 'taxAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Cash', value: 'cash' }
      ],
      defaultValue: 'stripe',
    },
    {
      name: 'refundReason',
      type: 'textarea',
    },
    {
      name: 'refundedAt',
      type: 'date',
    },
    {
      name: 'refundAmount',
      type: 'number',
      min: 0,
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
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Generate invoice number if not provided
        if (!data.invoiceNumber) {
          const timestamp = Date.now().toString().slice(-6)
          const random = Math.random().toString(36).substring(2, 5).toUpperCase()
          data.invoiceNumber = `INV-${timestamp}-${random}`
        }
        
        // Calculate totals
        if (data.items && data.items.length > 0) {
          data.subtotal = data.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0)
          data.taxAmount = (data.subtotal * (data.taxRate || 0)) / 100
          data.totalAmount = data.subtotal + data.taxAmount
        }
        
        // Update timestamp
        data.updatedAt = new Date()
        
        return data
      }
    ],
  },
  access: {
    create: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    read: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }: any) => {
      if (!user) return false
      return true
    },
    delete: ({ req: { user } }: any) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
}

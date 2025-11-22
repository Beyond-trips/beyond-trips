import type { CollectionConfig } from 'payload'

export const DriverWithdrawals: CollectionConfig = {
  slug: 'driver-withdrawals',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user) return true // Allow drivers to create withdrawal requests
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
        description: 'Driver requesting withdrawal',
      },
    },
    {
      name: 'amount',
      type: 'number',
      min: 0,
      required: true,
      admin: {
        description: 'Withdrawal amount in Naira',
      },
    },
    {
      name: 'currency',
      type: 'select',
      options: [
        { label: 'NGN', value: 'NGN' }
      ],
      defaultValue: 'NGN',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' }
      ],
      defaultValue: 'pending',
      required: true,
    },
    {
      name: 'bankDetails',
      type: 'group',
      fields: [
        {
          name: 'bankName',
          type: 'text',
          required: true,
        },
        {
          name: 'accountName',
          type: 'text',
          required: true,
        },
        {
          name: 'accountNumber',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      admin: {
        description: 'Reason for withdrawal (optional)',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        description: 'Admin notes (only visible to admins)',
      },
    },
    {
      name: 'processedAt',
      type: 'date',
      admin: {
        description: 'Date when withdrawal was processed',
      },
    },
    {
      name: 'processedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who processed the withdrawal',
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
        // Set processedAt when status changes to completed
        if (data.status === 'completed' && !data.processedAt) {
          data.processedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}

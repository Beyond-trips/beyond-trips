// collections/UserBankDetails.ts
import type { CollectionConfig } from 'payload'

export const UserBankDetails: CollectionConfig = {
  slug: 'user-bank-details',
  admin: {
    useAsTitle: 'accountName',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'bankName',
      type: 'select',
      options: [
        { label: 'Access Bank', value: 'access_bank' },
        { label: 'GTBank', value: 'gtbank' },
        { label: 'First Bank', value: 'first_bank' },
        { label: 'Zenith Bank', value: 'zenith_bank' },
        { label: 'UBA', value: 'uba' },
        { label: 'Ecobank', value: 'ecobank' },
        { label: 'Stanbic IBTC', value: 'stanbic_ibtc' },
        { label: 'Fidelity Bank', value: 'fidelity_bank' },
        { label: 'Union Bank', value: 'union_bank' },
        { label: 'Sterling Bank', value: 'sterling_bank' },
        { label: 'Wema Bank', value: 'wema_bank' },
        { label: 'FCMB', value: 'fcmb' },
        { label: 'AAA Finance', value: 'aaa_finance' },
      ],
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
      admin: {
        description: 'Must be exactly 10 digits',
      },
    },
    {
      name: 'verificationStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Failed', value: 'failed' }
      ],
      defaultValue: 'pending',
    },
    {
      name: 'verifiedAt',
      type: 'date',
    },
  ],
}
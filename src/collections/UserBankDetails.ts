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
        // Banks with International Authorization
        { label: 'Access Bank', value: 'access_bank' },
        { label: 'Fidelity Bank', value: 'fidelity_bank' },
        { label: 'First City Monument Bank', value: 'fcmb' },
        { label: 'First Bank', value: 'first_bank' },
        { label: 'GTBank', value: 'gtbank' },
        { label: 'UBA', value: 'uba' },
        { label: 'Zenith Bank', value: 'zenith_bank' },

        // Commercial Banks with National Authorization
        { label: 'Citibank Nigeria', value: 'citibank' },
        { label: 'Ecobank', value: 'ecobank' },
        { label: 'Heritage Bank', value: 'heritage_bank' },
        { label: 'Globus Bank', value: 'globus_bank' },
        { label: 'Keystone Bank', value: 'keystone_bank' },
        { label: 'Polaris Bank', value: 'polaris_bank' },
        { label: 'Stanbic IBTC', value: 'stanbic_ibtc' },
        { label: 'Standard Chartered Bank', value: 'standard_chartered' },
        { label: 'Sterling Bank', value: 'sterling_bank' },
        { label: 'Titan Trust Bank', value: 'titan_trust_bank' },
        { label: 'Union Bank', value: 'union_bank' },
        { label: 'Unity Bank', value: 'unity_bank' },
        { label: 'Wema Bank', value: 'wema_bank' },
        { label: 'Premium Trust Bank', value: 'premium_trust_bank' },
        { label: 'Optimus Bank', value: 'optimus_bank' },

        // Commercial Banks with Regional Licenses
        { label: 'Providus Bank', value: 'providus_bank' },
        { label: 'Parallex Bank', value: 'parallex_bank' },

        // Digital/FIntech Microfinance Banks
        { label: 'Kuda Bank', value: 'kuda_bank' },
        { label: 'Opay', value: 'opay' },
        { label: 'Moniepoint', value: 'moniepoint' },
        { label: 'PalmPay', value: 'palmpay' },
        { label: 'FairMoney', value: 'fairmoney' },
        { label: 'VFD Bank', value: 'vfd_bank' },
        { label: 'Nombank (Amucha)', value: 'nombank' },

        // Custom Entry
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
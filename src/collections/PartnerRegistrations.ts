// collections/PartnerRegistrations.ts
import type { CollectionConfig } from 'payload'

export const PartnerRegistrations: CollectionConfig = {
  slug: 'partner-registrations',
  admin: {
    useAsTitle: 'registrationId',
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'registrationId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'businessDetails',
      type: 'relationship',
      relationTo: 'business-details',
    },
    {
      name: 'adCampaign',
      type: 'relationship',
      relationTo: 'ad-campaigns',
    },
    {
      name: 'subscriptionPlan',
      type: 'relationship',
      relationTo: 'subscription-plans',
    },
    {
      name: 'currentStep',
      type: 'select',
      options: [
        { label: 'Business Details', value: 'business_details' },
        { label: 'Email Verification', value: 'email_verification' },
        { label: 'Ad Campaign Setup', value: 'ad_campaign_setup' },
        { label: 'Payment & Budgeting', value: 'payment_budgeting' },
        { label: 'Submission & Confirmation', value: 'submission_confirmation' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'business_details',
    },
    {
      name: 'completedSteps',
      type: 'array',
      fields: [
        {
          name: 'step',
          type: 'select',
          options: [
            { label: 'Business Details', value: 'business_details' },
            { label: 'Email Verification', value: 'email_verification' },
            { label: 'Ad Campaign Setup', value: 'ad_campaign_setup' },
            { label: 'Payment & Budgeting', value: 'payment_budgeting' },
            { label: 'Submission & Confirmation', value: 'submission_confirmation' },
          ],
          required: true,
        },
        {
          name: 'completedAt',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'overallStatus',
      type: 'select',
      options: [
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Pending Approval', value: 'pending_approval' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'in_progress',
    },
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'verificationCode',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'codeExpiresAt',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && !data.registrationId) {
          data.registrationId = `REG-${Date.now()}`
        }
        return data
      },
    ],
  },
}
import type { CollectionConfig } from 'payload'

export const UserOnboarding: CollectionConfig = {
  slug: 'user-onboarding',
  admin: {
    useAsTitle: 'userId',
  },
  fields: [
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
    },
    {
      name: 'currentStep',
      type: 'select',
      options: [
        { label: 'Basic Details', value: 'basic_details' },
        { label: 'Document Upload', value: 'document_upload' },
        { label: 'Bank & Payment Details', value: 'bank_payment' },
        { label: 'Training & Compliance', value: 'training' },
        { label: 'Confirmation & Dashboard Access', value: 'completed' },
      ],
      defaultValue: 'basic_details',
    },
    {
      name: 'stepsCompleted',
      type: 'array',
      fields: [
        {
          name: 'step',
          type: 'select',
          options: [
            'basic_details',
            'document_upload', 
            'bank_payment',
            'training',
            'completed'
          ],
        },
        {
          name: 'completedAt',
          type: 'date',
          defaultValue: () => new Date(),
        },
      ],
    },
    {
      name: 'onboardingStatus',
      type: 'select',
      options: [
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Pending Review', value: 'pending_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'in_progress',
    },
    {
      name: 'startedAt',
      type: 'date',
      defaultValue: () => new Date(),
    },
    {
      name: 'completedAt',
      type: 'date',
    },
    {
      name: 'approvedAt',
      type: 'date',
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes for admin review',
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        description: 'Reason for registration rejection (shown to driver)',
      },
    },
  ],
}
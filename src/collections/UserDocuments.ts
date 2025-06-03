import type { CollectionConfig } from 'payload'

export const UserDocuments: CollectionConfig = {
  slug: 'user-documents',
  admin: {
    useAsTitle: 'documentType',
  },
  fields: [
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'documentType',
      type: 'select',
      options: [
        { label: "Driver's License", value: 'drivers_license' },
        { label: 'National ID', value: 'national_id' },
        { label: 'Vehicle Registration', value: 'vehicle_registration' },
      ],
      required: true,
    },
    {
      name: 'documentFile',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'verificationStatus',
      type: 'select',
      options: ['pending', 'approved', 'rejected'],
      defaultValue: 'pending',
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
    },
    {
      name: 'uploadedAt',
      type: 'date',
      defaultValue: () => new Date(),
    },
  ],
}
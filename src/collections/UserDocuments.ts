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
      name: 'documentStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Expired', value: 'expired' },
        { label: 'Resubmitted', value: 'resubmitted' },
      ],
      admin: {
        description: 'Current KYC verification status of this document',
      },
    },
    {
      name: 'verificationStatus',
      type: 'select',
      options: ['pending', 'approved', 'rejected'],
      defaultValue: 'pending',
      admin: {
        description: 'Legacy field - use documentStatus instead',
        readOnly: true,
      },
    },
    {
      name: 'verifiedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when document was verified',
        readOnly: true,
      },
    },
    {
      name: 'verifiedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin user who verified this document',
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Document expiration date (e.g., license expiry)',
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        description: 'Reason for document rejection',
        condition: (data) => data?.documentStatus === 'rejected',
      },
    },
    {
      name: 'resubmittedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when document was resubmitted after rejection',
        readOnly: true,
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        description: 'Internal admin notes about this document',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
    },
    {
      name: 'uploadedAt',
      type: 'date',
      defaultValue: () => new Date(),
      admin: {
        description: 'Initial upload timestamp',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Track resubmission timestamp
        if (operation === 'update' && originalDoc) {
          const wasRejected = originalDoc.documentStatus === 'rejected'
          const isNowPending = data.documentStatus === 'pending' || data.documentStatus === 'resubmitted'
          
          if (wasRejected && isNowPending) {
            data.documentStatus = 'resubmitted'
            data.resubmittedAt = new Date().toISOString()
            console.log('📄 Document resubmitted after rejection:', originalDoc.id)
          }
        }

        // Synchronize with legacy verificationStatus field
        if (data.documentStatus === 'verified') {
          data.verificationStatus = 'approved'
        } else if (data.documentStatus === 'rejected') {
          data.verificationStatus = 'rejected'
        } else {
          data.verificationStatus = 'pending'
        }

        return data
      },
    ],
  },
  timestamps: true,
}
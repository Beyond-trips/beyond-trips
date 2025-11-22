import { CollectionConfig } from 'payload'

const BankDetailsRequests: CollectionConfig = {
  slug: 'bank-details-requests',
  admin: {
    useAsTitle: 'driver',
    defaultColumns: ['driver', 'status', 'requestedAt'],
    group: 'Driver Management',
  },
  access: {
    // Only authenticated users can read
    read: ({ req: { user } }) => {
      if (!user) return false
      
      // Admins can see all requests
      if (user.role === 'admin') return true
      
      // Drivers can only see their own requests
      return {
        driver: {
          equals: user.id,
        },
      }
    },
    // Only drivers can create requests
    create: ({ req: { user } }) => {
      return user?.role === 'user' // Drivers have 'user' role
    },
    // Only admins can update (approve/reject)
    update: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can delete
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Driver who requested the bank details update',
      },
    },
    {
      name: 'oldBankDetails',
      type: 'group',
      label: 'Old Bank Details',
      fields: [
        {
          name: 'bankName',
          type: 'text',
          required: true,
          admin: {
            description: 'Previous bank name',
          },
        },
        {
          name: 'accountNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'Previous account number',
          },
        },
        {
          name: 'accountName',
          type: 'text',
          required: true,
          admin: {
            description: 'Previous account holder name',
          },
        },
      ],
    },
    {
      name: 'newBankDetails',
      type: 'group',
      label: 'New Bank Details',
      fields: [
        {
          name: 'bankName',
          type: 'text',
          required: true,
          admin: {
            description: 'New bank name',
          },
        },
        {
          name: 'accountNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'New account number',
          },
        },
        {
          name: 'accountName',
          type: 'text',
          required: true,
          admin: {
            description: 'New account holder name',
          },
        },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Reason for requesting bank details change',
        rows: 3,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Approved',
          value: 'approved',
        },
        {
          label: 'Rejected',
          value: 'rejected',
        },
      ],
      admin: {
        description: 'Current status of the request',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        description: 'Admin notes (visible only to admins)',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
        rows: 3,
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        description: 'Reason for rejection (required if rejected)',
        condition: (data) => data?.status === 'rejected',
        rows: 2,
      },
    },
    {
      name: 'verificationStatus',
      type: 'select',
      options: [
        {
          label: 'Unverified',
          value: 'unverified',
        },
        {
          label: 'Verified',
          value: 'verified',
        },
        {
          label: 'Failed',
          value: 'failed',
        },
      ],
      defaultValue: 'unverified',
      admin: {
        description: 'Bank account verification status',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
    },
    {
      name: 'verificationNotes',
      type: 'textarea',
      admin: {
        description: 'Verification details or notes',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
        rows: 2,
      },
    },
    {
      name: 'requestedAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'When the request was submitted',
      },
      hooks: {
        beforeChange: [
          ({ value, operation }) => {
            // Set requestedAt on creation
            if (operation === 'create' && !value) {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'processedAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'When the request was processed',
        readOnly: true,
      },
    },
    {
      name: 'processedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who processed the request',
        readOnly: true,
      },
    },
    {
      name: 'notificationSent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether driver was notified of the decision',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data, req, originalDoc }) => {
        // Set processedAt and processedBy when status changes to approved/rejected
        if (operation === 'update') {
          const statusChanged = originalDoc?.status !== data.status
          
          if (statusChanged && (data.status === 'approved' || data.status === 'rejected')) {
            data.processedAt = new Date().toISOString()
            data.processedBy = req.user?.id
          }
        }
        
        return data
      },
    ],
    afterChange: [
      async ({ operation, doc, req }) => {
        // After status change to approved, update the actual bank details
        if (operation === 'update' && doc.status === 'approved') {
          try {
            // Update the driver's bank details in user-bank-details collection
            const existingBankDetails = await req.payload.find({
              collection: 'user-bank-details',
              where: {
                userId: {
                  equals: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                },
              },
              limit: 1,
            })

            if (existingBankDetails.docs.length > 0) {
              // Update existing bank details
              await req.payload.update({
                collection: 'user-bank-details',
                id: existingBankDetails.docs[0].id,
                data: {
                  bankName: doc.newBankDetails.bankName,
                  accountNumber: doc.newBankDetails.accountNumber,
                  accountName: doc.newBankDetails.accountName,
                  updatedAt: new Date().toISOString(),
                },
              })
            } else {
              // Create new bank details if none exist
              await req.payload.create({
                collection: 'user-bank-details',
                data: {
                  userId: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                  bankName: doc.newBankDetails.bankName,
                  accountNumber: doc.newBankDetails.accountNumber,
                  accountName: doc.newBankDetails.accountName,
                },
              })
            }

            // Create notification for driver
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                type: 'payment',
                title: 'Bank Details Updated',
                message: `Your bank details update request has been approved. Your new bank account (${doc.newBankDetails.accountNumber}) is now active.`,
                isRead: false,
                priority: 'high',
              },
            })

            console.log('✅ Bank details updated successfully for driver:', doc.driver)
          } catch (error) {
            console.error('❌ Error updating bank details:', error)
          }
        }

        // Send rejection notification
        if (operation === 'update' && doc.status === 'rejected') {
          try {
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                type: 'payment',
                title: 'Bank Details Update Rejected',
                message: doc.rejectionReason || 'Your bank details update request has been rejected. Please contact support for more information.',
                isRead: false,
                priority: 'high',
              },
            })

            console.log('✅ Rejection notification sent to driver:', doc.driver)
          } catch (error) {
            console.error('❌ Error sending rejection notification:', error)
          }
        }
      },
    ],
  },
  timestamps: true,
}

export default BankDetailsRequests


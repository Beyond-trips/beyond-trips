import { CollectionConfig } from 'payload'

const MagazinePickups: CollectionConfig = {
  slug: 'magazine-pickups',
  admin: {
    useAsTitle: 'driver',
    defaultColumns: ['driver', 'magazine', 'status', 'pickupDate'],
    group: 'Magazine Management',
  },
  access: {
    // Only authenticated users can read
    read: ({ req: { user } }) => {
      if (!user) return false
      
      // Admins can see all pickups
      if (user.role === 'admin') return true
      
      // Drivers can only see their own pickups
      return {
        driver: {
          equals: user.id,
        },
      }
    },
    // Only drivers can create pickup requests
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
        description: 'Driver requesting the magazine pickup',
      },
    },
    {
      name: 'magazine',
      type: 'relationship',
      relationTo: 'driver-magazines',
      required: true,
      admin: {
        description: 'Magazine edition to be picked up',
      },
    },
    {
      name: 'quantity',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: {
        description: 'Number of magazines to pick up',
      },
    },
    {
      name: 'location',
      type: 'group',
      label: 'Pickup Location',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Location name (e.g., "Lagos HQ")',
          },
        },
        {
          name: 'address',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Full address',
            rows: 2,
          },
        },
        {
          name: 'contactPerson',
          type: 'text',
          admin: {
            description: 'Contact person at location',
          },
        },
        {
          name: 'contactPhone',
          type: 'text',
          admin: {
            description: 'Contact phone number',
          },
        },
      ],
    },
    {
      name: 'pickupDate',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy',
        },
        description: 'Preferred pickup date',
      },
    },
    {
      name: 'returnDate',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy',
        },
        description: 'Expected return date',
        readOnly: true,
      },
    },
    {
      name: 'actualReturnDate',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy',
        },
        description: 'Actual return date',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'requested',
      options: [
        {
          label: 'Requested',
          value: 'requested',
        },
        {
          label: 'Approved',
          value: 'approved',
        },
        {
          label: 'Rejected',
          value: 'rejected',
        },
        {
          label: 'Picked Up',
          value: 'picked-up',
        },
        {
          label: 'Active',
          value: 'active',
        },
        {
          label: 'Returned',
          value: 'returned',
        },
        {
          label: 'Lost',
          value: 'lost',
        },
        {
          label: 'Damaged',
          value: 'damaged',
        },
      ],
      admin: {
        description: 'Current status of the pickup',
      },
    },
    {
      name: 'qrCode',
      type: 'text',
      admin: {
        description: 'QR code for pickup/return verification',
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Driver notes or special requests',
        rows: 3,
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
        description: 'Reason for rejection',
        condition: (data) => data?.status === 'rejected',
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
        description: 'When the pickup was requested',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ value, operation }) => {
            if (operation === 'create' && !value) {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'approvedAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'When the pickup was approved',
        readOnly: true,
      },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who approved the pickup',
        readOnly: true,
      },
    },
    {
      name: 'pickedUpAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'When magazines were actually picked up',
        readOnly: true,
      },
    },
    {
      name: 'activatedAt',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'When driver activated the magazine to their account',
        readOnly: true,
      },
    },
    {
      name: 'activationBarcode',
      type: 'text',
      admin: {
        description: 'Barcode scanned during activation (TEST MODE: manually set to TEST-MAG-BTL-2025)',
        readOnly: false, // Temporarily editable for testing
      },
    },
    {
      name: 'verificationCode',
      type: 'text',
      admin: {
        description: 'Verification code for pickup confirmation',
        readOnly: true,
      },
    },
    {
      name: 'earningSynced',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether earnings have been synced for this pickup',
        readOnly: true,
      },
    },
    {
      name: 'riderScans',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of times riders scanned this magazine for reviews',
      },
    },
    {
      name: 'btlCoinsEarned',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of BTL coins earned from rider interactions',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data, req, originalDoc }) => {
        // Generate QR code and verification code on approval
        if (operation === 'update' && originalDoc?.status !== 'approved' && data.status === 'approved') {
          // Generate unique QR code
          const qrCode = `PICKUP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`
          data.qrCode = qrCode
          
          // Generate 6-digit verification code
          data.verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
          
          // Set approved timestamp
          data.approvedAt = new Date().toISOString()
          data.approvedBy = req.user?.id
          
          // Set expected return date (30 days from approval)
          const returnDate = new Date()
          returnDate.setDate(returnDate.getDate() + 30)
          data.returnDate = returnDate.toISOString()
        }
        
        // Set pickedUpAt when status changes to picked-up
        if (operation === 'update' && originalDoc?.status !== 'picked-up' && data.status === 'picked-up') {
          data.pickedUpAt = new Date().toISOString()
        }
        
        // Set actualReturnDate when status changes to returned
        if (operation === 'update' && originalDoc?.status !== 'returned' && data.status === 'returned') {
          data.actualReturnDate = new Date().toISOString()
        }
        
        return data
      },
    ],
    afterChange: [
      async ({ operation, doc, req }) => {
        // Send notification when request is approved
        if (operation === 'update' && doc.status === 'approved') {
          try {
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                type: 'magazine',
                title: 'Magazine Pickup Approved',
                message: `Your magazine pickup request has been approved. Pickup code: ${doc.verificationCode}. Please pick up within 7 days.`,
                isRead: false,
                priority: 'high',
              },
            })
            console.log('✅ Pickup approval notification sent to driver:', doc.driver)
          } catch (error) {
            console.error('❌ Error sending approval notification:', error)
          }
        }
        
        // Send notification when request is rejected
        if (operation === 'update' && doc.status === 'rejected') {
          try {
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                type: 'magazine',
                title: 'Magazine Pickup Rejected',
                message: doc.rejectionReason || 'Your magazine pickup request has been rejected. Please contact support.',
                isRead: false,
                priority: 'high',
              },
            })
            console.log('✅ Pickup rejection notification sent to driver:', doc.driver)
          } catch (error) {
            console.error('❌ Error sending rejection notification:', error)
          }
        }
        
        // Send reminder notification when returned
        if (operation === 'update' && doc.status === 'returned') {
          try {
            await req.payload.create({
              collection: 'driver-notifications',
              data: {
                driver: typeof doc.driver === 'object' ? doc.driver.id : doc.driver,
                type: 'magazine',
                title: 'Magazine Returned Successfully',
                message: 'Thank you for returning the magazines. Your earnings will be processed soon.',
                isRead: false,
                priority: 'medium',
              },
            })
            console.log('✅ Return confirmation notification sent to driver:', doc.driver)
          } catch (error) {
            console.error('❌ Error sending return notification:', error)
          }
        }
      },
    ],
  },
  timestamps: true,
}

export default MagazinePickups


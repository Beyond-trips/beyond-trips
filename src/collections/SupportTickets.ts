// New collection: src/collections/SupportTickets.ts
import { CollectionConfig } from 'payload'

const SupportTickets: CollectionConfig = {
  slug: 'support-tickets',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['ticketNumber', 'subject', 'submittedBy', 'priority', 'status', 'createdAt'],
    group: 'Support Management',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      // Admins can see all tickets
      if (user.role === 'admin') return true
      // Users can only see their own tickets
      return {
        submittedBy: {
          equals: user.id
        }
      }
    },
    create: ({ req: { user } }) => !!user, // Any authenticated user can create
    update: ({ req: { user } }) => user?.role === 'admin', // Only admins can update
    delete: ({ req: { user } }) => user?.role === 'admin', // Only admins can delete
  },
  fields: [
    {
      name: 'ticketNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Auto-generated ticket number',
        readOnly: true,
      },
    },
    {
      name: 'submittedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who submitted the ticket',
        readOnly: true,
      },
    },
    {
      name: 'userRole',
      type: 'select',
      required: true,
      options: [
        { label: 'Driver', value: 'driver' },
        { label: 'Advertiser', value: 'advertiser' },
        { label: 'Admin', value: 'admin' },
      ],
      admin: {
        description: 'Role of the user submitting the ticket',
        readOnly: true,
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Technical Issue', value: 'technical' },
        { label: 'Payment Issue', value: 'payment' },
        { label: 'Account Issue', value: 'account' },
        { label: 'Campaign Issue', value: 'campaign' },
        { label: 'Magazine Issue', value: 'magazine' },
        { label: 'General Inquiry', value: 'general' },
        { label: 'Feature Request', value: 'feature_request' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Category of the support ticket',
      },
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'Brief subject line for the ticket',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Detailed description of the issue',
        rows: 5,
      },
    },
    {
      name: 'attachments',
      type: 'array',
      fields: [
        {
          name: 'file',
          type: 'relationship',
          relationTo: 'media',
        },
        {
          name: 'fileName',
          type: 'text',
        },
      ],
      admin: {
        description: 'Supporting files or screenshots',
      },
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      defaultValue: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
      admin: {
        description: 'Priority level of the ticket',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Waiting for User', value: 'waiting_user' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        description: 'Current status of the ticket',
      },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin assigned to handle this ticket',
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
    },
    {
      name: 'responses',
      type: 'array',
      fields: [
        {
          name: 'respondedBy',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'responseText',
          type: 'textarea',
          required: true,
          admin: {
            rows: 4,
          },
        },
        {
          name: 'isInternal',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Internal note (not visible to user)',
          },
        },
        {
          name: 'respondedAt',
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: {
            readOnly: true,
          },
        },
      ],
      admin: {
        description: 'Admin responses and internal notes',
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when ticket was resolved',
        readOnly: true,
      },
    },
    {
      name: 'resolvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who resolved the ticket',
        readOnly: true,
      },
    },
    {
      name: 'resolutionNotes',
      type: 'textarea',
      admin: {
        description: 'Notes about the resolution',
        rows: 3,
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
      admin: {
        description: 'Tags for categorization and search',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // Generate ticket number on creation
        if (operation === 'create' && !data.ticketNumber) {
          const timestamp = Date.now().toString().slice(-8)
          const random = Math.random().toString(36).substring(2, 6).toUpperCase()
          data.ticketNumber = `TKT-${timestamp}-${random}`
        }

        // Set user role from authenticated user
        if (operation === 'create' && req.user) {
          data.userRole = req.user.role === 'admin' ? 'admin' : 
                          (req.user as any).role === 'partner' ? 'advertiser' : 'driver'
        }

        // Track resolution
        if (data.status === 'resolved' && !data.resolvedAt) {
          data.resolvedAt = new Date().toISOString()
          if (req.user) {
            data.resolvedBy = req.user.id
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}

export default SupportTickets


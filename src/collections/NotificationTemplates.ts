import { CollectionConfig } from 'payload'

const NotificationTemplates: CollectionConfig = {
  slug: 'notification-templates',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'isActive', 'updatedAt'],
    group: 'System Management',
    description: 'Reusable notification templates',
  },
  access: {
    // Only admins can manage templates
    read: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    create: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    update: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Template name for identification',
      },
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique template code (e.g., "PAYOUT_APPROVED", "CAMPAIGN_REJECTED")',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Payment', value: 'payment' },
        { label: 'Campaign', value: 'campaign' },
        { label: 'Magazine', value: 'magazine' },
        { label: 'System', value: 'system' },
      ],
      admin: {
        description: 'Notification category',
      },
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'Notification title/subject (supports variables like {{name}})',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Notification message body (supports HTML and variables)',
        rows: 5,
      },
    },
    {
      name: 'smsText',
      type: 'textarea',
      admin: {
        description: 'SMS-specific message (plain text only, 160 chars recommended)',
        rows: 3,
        condition: (data, siblingData) => {
          return siblingData?.channels?.includes('sms')
        },
      },
    },
    {
      name: 'variables',
      type: 'array',
      label: 'Template Variables',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Variable name (e.g., "amount", "campaign_name")',
          },
        },
        {
          name: 'description',
          type: 'text',
          admin: {
            description: 'What this variable represents',
          },
        },
        {
          name: 'example',
          type: 'text',
          admin: {
            description: 'Example value',
          },
        },
      ],
      admin: {
        description: 'Variables that can be used in subject and body (use {{variable_name}})',
      },
    },
    {
      name: 'channels',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['in_app'],
      options: [
        { label: 'In-App', value: 'in_app' },
        { label: 'Email', value: 'email' },
        { label: 'SMS', value: 'sms' },
      ],
      admin: {
        description: 'Delivery channels for this notification',
      },
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      defaultValue: 'normal',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      admin: {
        description: 'Notification priority level',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this template is currently active',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who created this template',
        readOnly: true,
      },
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who last updated this template',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
          data.updatedBy = req.user.id
        }
        
        if (operation === 'update' && req.user) {
          data.updatedBy = req.user.id
        }
        
        return data
      },
    ],
  },
  timestamps: true,
}

export default NotificationTemplates


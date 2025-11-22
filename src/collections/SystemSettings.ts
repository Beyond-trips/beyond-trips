import { CollectionConfig } from 'payload'

const SystemSettings: CollectionConfig = {
  slug: 'system-settings',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'category', 'value', 'updatedAt'],
    group: 'System Management',
    description: 'Platform configuration and settings',
  },
  access: {
    // Only admins can read settings
    read: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can create settings
    create: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can update settings
    update: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can delete settings
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique setting key (e.g., "scan_earning_rate", "min_withdrawal_amount")',
      },
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      admin: {
        description: 'Setting value (can be string, number, boolean, or JSON)',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'String',
          value: 'string',
        },
        {
          label: 'Number',
          value: 'number',
        },
        {
          label: 'Boolean',
          value: 'boolean',
        },
        {
          label: 'JSON',
          value: 'json',
        },
      ],
      defaultValue: 'string',
      admin: {
        description: 'Data type of the value',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        {
          label: 'System',
          value: 'system',
        },
        {
          label: 'Payments',
          value: 'payments',
        },
        {
          label: 'Notifications',
          value: 'notifications',
        },
        {
          label: 'Platform',
          value: 'platform',
        },
        {
          label: 'Features',
          value: 'features',
        },
      ],
      admin: {
        description: 'Setting category for organization',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Human-readable description of what this setting controls',
        rows: 2,
      },
    },
    {
      name: 'isEditable',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this setting can be edited via UI (system-critical settings should be false)',
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this setting is visible to non-admin users',
      },
    },
    {
      name: 'validationRules',
      type: 'group',
      label: 'Validation Rules',
      fields: [
        {
          name: 'min',
          type: 'number',
          admin: {
            description: 'Minimum value (for number types)',
          },
        },
        {
          name: 'max',
          type: 'number',
          admin: {
            description: 'Maximum value (for number types)',
          },
        },
        {
          name: 'regex',
          type: 'text',
          admin: {
            description: 'Regex pattern for validation (for string types)',
          },
        },
        {
          name: 'options',
          type: 'textarea',
          admin: {
            description: 'Allowed options (comma-separated, for string types)',
            rows: 2,
          },
        },
      ],
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who last updated this setting',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // Set updatedBy on updates
        if (operation === 'update' && req.user) {
          data.updatedBy = req.user.id
        }
        
        return data
      },
    ],
  },
  timestamps: true,
}

export default SystemSettings


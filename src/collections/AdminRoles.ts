import { CollectionConfig } from 'payload'

const AdminRoles: CollectionConfig = {
  slug: 'admin-roles',
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'name', 'isSystemRole', 'updatedAt'],
    group: 'System Management',
    description: 'Admin user roles and permissions',
  },
  access: {
    // Only admins can read roles
    read: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can create roles
    create: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can update roles
    update: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Only admins can delete non-system roles
    delete: ({ req: { user }, data }) => {
      if (user?.role !== 'admin') return false
      // Cannot delete system roles
      return !(data as any)?.isSystemRole
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Role identifier (e.g., "super_admin", "content_manager")',
      },
    },
    {
      name: 'displayName',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable role name',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Role description and responsibilities',
        rows: 3,
      },
    },
    {
      name: 'permissions',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        // User Management
        { label: 'View Users', value: 'users.view' },
        { label: 'Create Users', value: 'users.create' },
        { label: 'Edit Users', value: 'users.edit' },
        { label: 'Delete Users', value: 'users.delete' },
        
        // Campaign Management
        { label: 'View Campaigns', value: 'campaigns.view' },
        { label: 'Approve Campaigns', value: 'campaigns.approve' },
        { label: 'Reject Campaigns', value: 'campaigns.reject' },
        { label: 'Pause Campaigns', value: 'campaigns.pause' },
        { label: 'Delete Campaigns', value: 'campaigns.delete' },
        
        // Payment Management
        { label: 'View Payments', value: 'payments.view' },
        { label: 'Approve Payouts', value: 'payments.approve' },
        { label: 'Reject Payouts', value: 'payments.reject' },
        { label: 'Complete Payouts', value: 'payments.complete' },
        
        // Magazine Management
        { label: 'View Magazines', value: 'magazines.view' },
        { label: 'Create Magazines', value: 'magazines.create' },
        { label: 'Edit Magazines', value: 'magazines.edit' },
        { label: 'Delete Magazines', value: 'magazines.delete' },
        { label: 'Approve Pickups', value: 'magazines.approve_pickups' },
        
        // Settings Management
        { label: 'View Settings', value: 'settings.view' },
        { label: 'Edit Settings', value: 'settings.edit' },
        
        // Roles Management
        { label: 'View Roles', value: 'roles.view' },
        { label: 'Create Roles', value: 'roles.create' },
        { label: 'Edit Roles', value: 'roles.edit' },
        { label: 'Delete Roles', value: 'roles.delete' },
        
        // Analytics & Reports
        { label: 'View Analytics', value: 'analytics.view' },
        { label: 'Export Reports', value: 'analytics.export' },
        
        // Notifications
        { label: 'Send Notifications', value: 'notifications.send' },
        { label: 'Manage Templates', value: 'notifications.templates' },
      ],
      admin: {
        description: 'Permissions assigned to this role',
      },
    },
    {
      name: 'isSystemRole',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'System roles cannot be deleted (e.g., Super Admin)',
        readOnly: true,
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who created this role',
        readOnly: true,
      },
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who last updated this role',
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

export default AdminRoles


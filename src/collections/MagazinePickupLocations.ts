import { CollectionConfig } from 'payload'

const MagazinePickupLocations: CollectionConfig = {
  slug: 'magazine-pickup-locations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'address', 'availableQuantity', 'status'],
    group: 'Magazine Management',
  },
  access: {
    // Everyone can read locations
    read: () => true,
    // Only admins can create/update/delete
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Location name (e.g., "Lagos HQ", "Abuja Office")',
      },
    },
    {
      name: 'address',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Full address of the pickup location',
        rows: 3,
      },
    },
    {
      name: 'city',
      type: 'text',
      admin: {
        description: 'City where the location is situated',
      },
    },
    {
      name: 'state',
      type: 'text',
      admin: {
        description: 'State/Region',
      },
    },
    {
      name: 'coordinates',
      type: 'group',
      label: 'GPS Coordinates',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          admin: {
            description: 'Latitude coordinate',
          },
        },
        {
          name: 'longitude',
          type: 'number',
          admin: {
            description: 'Longitude coordinate',
          },
        },
      ],
    },
    {
      name: 'contactPerson',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the contact person at this location',
      },
    },
    {
      name: 'contactPhone',
      type: 'text',
      required: true,
      admin: {
        description: 'Phone number for the contact person',
      },
    },
    {
      name: 'contactEmail',
      type: 'email',
      admin: {
        description: 'Email address for the contact person',
      },
    },
    {
      name: 'availableQuantity',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Number of magazines currently available at this location',
      },
    },
    {
      name: 'capacity',
      type: 'number',
      defaultValue: 100,
      min: 0,
      admin: {
        description: 'Maximum capacity of magazines this location can hold',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        {
          label: 'Active',
          value: 'active',
        },
        {
          label: 'Inactive',
          value: 'inactive',
        },
        {
          label: 'Temporarily Closed',
          value: 'temporarily_closed',
        },
      ],
      admin: {
        description: 'Current operational status of the location',
      },
    },
    {
      name: 'operatingHours',
      type: 'group',
      label: 'Operating Hours',
      fields: [
        {
          name: 'weekdays',
          type: 'text',
          defaultValue: '9:00 AM - 5:00 PM',
          admin: {
            description: 'Monday to Friday operating hours',
          },
        },
        {
          name: 'saturday',
          type: 'text',
          defaultValue: '10:00 AM - 2:00 PM',
          admin: {
            description: 'Saturday operating hours',
          },
        },
        {
          name: 'sunday',
          type: 'text',
          defaultValue: 'Closed',
          admin: {
            description: 'Sunday operating hours',
          },
        },
      ],
    },
    {
      name: 'specialInstructions',
      type: 'textarea',
      admin: {
        description: 'Special instructions for drivers picking up from this location',
        rows: 3,
      },
    },
    {
      name: 'magazineEdition',
      type: 'relationship',
      relationTo: 'driver-magazines',
      admin: {
        description: 'Current magazine edition available at this location',
      },
    },
    {
      name: 'lastStockUpdate',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy HH:mm',
        },
        description: 'Last time the stock quantity was updated',
        readOnly: true,
      },
    },
    {
      name: 'totalPickups',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Total number of pickups from this location',
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal admin notes about this location',
        rows: 3,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data }) => {
        // Update lastStockUpdate timestamp when availableQuantity changes
        if (data.availableQuantity !== undefined) {
          data.lastStockUpdate = new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}

export default MagazinePickupLocations


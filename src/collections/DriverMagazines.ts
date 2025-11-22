import type { CollectionConfig } from 'payload'

export const DriverMagazines: CollectionConfig = {
  slug: 'driver-magazines',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    read: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Magazine title',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Magazine description',
      },
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description: 'Magazine content',
      },
    },
    {
      name: 'imageUrl',
      type: 'text',
      admin: {
        description: 'Magazine cover image URL',
      },
    },
    {
      name: 'readTime',
      type: 'number',
      min: 1,
      admin: {
        description: 'Estimated read time in minutes',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Tips', value: 'tips' },
        { label: 'Safety', value: 'safety' },
        { label: 'Earnings', value: 'earnings' },
        { label: 'Community', value: 'community' },
        { label: 'Updates', value: 'updates' }
      ],
      defaultValue: 'news',
      required: true,
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this magazine is published',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        description: 'When this magazine was published',
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
        description: 'Tags for categorization',
      },
    },
    {
      name: 'editionNumber',
      type: 'number',
      required: true,
      admin: {
        description: 'Magazine edition number (e.g., 1, 2, 3...)',
      },
    },
    {
      name: 'issueDate',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'MMM dd, yyyy',
        },
        description: 'Magazine issue date',
      },
    },
    {
      name: 'totalCopiesPrinted',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Total number of physical copies printed for this edition',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'archived',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Magazine edition status (only one edition can be active at a time)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Is this the currently active magazine edition? (Only one can be active)',
      },
    },
    {
      name: 'barcode',
      type: 'text',
      unique: true,
      admin: {
        description: 'Unique barcode for this magazine edition (for scanning)',
      },
    },
    {
      name: 'qrImageUrl',
      type: 'text',
      admin: {
        description: 'S3 URL for the QR code image (preferred over base64)',
      },
    },
    {
      name: 'barcodeImage',
      type: 'textarea',
      admin: {
        description: 'Base64 encoded QR code image of the barcode (legacy - use qrImageUrl instead)',
        readOnly: true,
      },
    },
    {
      name: 'serialNumber',
      type: 'text',
      admin: {
        description: 'Serial number of physical magazine copy',
      },
    },
    {
      name: 'scansCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Total number of times this magazine was scanned',
      },
    },
    {
      name: 'isPrinted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this magazine has been physically printed (prevents new campaign linking)',
      },
    },
    {
      name: 'printedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when this magazine was marked as printed',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Set publishedAt when isPublished changes to true
        if (data.isPublished && !data.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }

        // ✅ CHECKPOINT: Enforce "only one active edition" business rule
        // If this edition is being set to active, deactivate all others
        if (data.isActive === true || data.status === 'active') {
          // Ensure both fields are synchronized
          data.isActive = true
          data.status = 'active'

          // Find all other active magazines and deactivate them
          try {
            const activeMagazines = await req.payload.find({
              collection: 'driver-magazines',
              where: {
                and: [
                  { isActive: { equals: true } },
                  ...(operation === 'update' && originalDoc?.id
                    ? [{ id: { not_equals: originalDoc.id } }]
                    : [])
                ]
              },
              limit: 100
            })

            console.log(`📚 Deactivating ${activeMagazines.docs.length} other magazine editions`)

            // Deactivate all other active magazines
            for (const mag of activeMagazines.docs) {
              await req.payload.update({
                collection: 'driver-magazines',
                id: mag.id,
                data: {
                  isActive: false,
                  status: 'archived'
                }
              })
            }
          } catch (error) {
            console.error('❌ Error deactivating other magazines:', error)
          }
        } else if (data.isActive === false || data.status === 'archived') {
          // Ensure both fields are synchronized
          data.isActive = false
          data.status = 'archived'
        }

        return data
      },
    ],
  },
}

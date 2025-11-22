import type { CollectionConfig } from 'payload'

/**
 * DriverScans Collection
 * 
 * Tracks QR code scans for analytics and fraud prevention purposes only.
 * NOTE: Scans no longer generate earnings automatically.
 * Drivers earn through BTL coins (rider interactions) and admin bonuses only.
 * Historical scan records with earnings remain intact for audit purposes.
 */
export const DriverScans: CollectionConfig = {
  slug: 'driver-scans',
  admin: {
    useAsTitle: 'barcode',
    description: 'QR code scan tracking for analytics (no earnings created)',
  },
  access: {
    create: ({ req: { user } }) => {
      if (user) return true // Allow drivers to create scan records
      return false
    },
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true // Admins can see all scans
      if (user) return true // Drivers can see their own scans
      return false
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true // Only admins can update scans
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true // Only admins can delete scans
      return false
    },
  },
  fields: [
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Driver who scanned the magazine',
      },
    },
    {
      name: 'magazine',
      type: 'relationship',
      relationTo: 'driver-magazines',
      required: true,
      admin: {
        description: 'Magazine that was scanned',
      },
    },
    {
      name: 'barcode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Barcode value (unique identifier)',
      },
    },
    {
      name: 'scannedAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Timestamp when barcode was scanned',
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      admin: {
        description: 'IP address of the scanning device (fraud prevention)',
      },
    },
    {
      name: 'deviceId',
      type: 'text',
      admin: {
        description: 'Device identifier (fraud prevention)',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Valid', value: 'valid' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Failed', value: 'failed' },
        { label: 'Suspicious', value: 'suspicious' }
      ],
      defaultValue: 'valid',
      required: true,
      admin: {
        description: 'Status of the scan (valid, duplicate, failed, suspicious)',
      },
    },
    {
      name: 'reason',
      type: 'textarea',
      admin: {
        description: 'Reason if scan was rejected (duplicate, failed, suspicious)',
      },
    },
    {
      name: 'earnings',
      type: 'relationship',
      relationTo: 'driver-earnings',
      admin: {
        description: 'Associated earnings record (if scan was successful)',
      },
    },
  ],
  indexes: [
    {
      fields: ['driver', 'magazine'],  // Prevent duplicate scans (same driver + magazine)
    },
    {
      fields: ['barcode'],              // Unique barcode lookup
    },
    {
      fields: ['scannedAt'],            // Time-based queries
    },
    {
      fields: ['driver', 'scannedAt'],  // Driver scan history
    },
  ],
}

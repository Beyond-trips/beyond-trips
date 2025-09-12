// collections/ProfilePicturesCloud.ts
import type { CollectionConfig } from 'payload'
import { profilePictureStorage } from '../config/cloudStorage'

export const ProfilePicturesCloud: CollectionConfig = {
  slug: 'profile-pictures-cloud',
  admin: {
    useAsTitle: 'alt',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => {
      if (!user) return false
      // Users can read their own profile pictures and business profile pictures
      return true
    },
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alt text for the profile picture',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption for the profile picture',
      },
    },
    {
      name: 'ownerType',
      type: 'select',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Business', value: 'business' },
      ],
      required: true,
      admin: {
        description: 'Type of profile picture owner',
      },
    },
    {
      name: 'ownerId',
      type: 'text',
      required: true,
      admin: {
        description: 'ID of the user or business that owns this profile picture',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this is the active profile picture',
      },
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'User who uploaded this profile picture',
      },
    },
    // Cloud storage fields
    {
      name: 'cloudStorage',
      type: 'group',
      fields: [
        {
          name: 'url',
          type: 'text',
          admin: {
            description: 'Direct S3 URL',
          },
        },
        {
          name: 'cdnUrl',
          type: 'text',
          admin: {
            description: 'CDN URL for faster access',
          },
        },
        {
          name: 'key',
          type: 'text',
          admin: {
            description: 'S3 object key',
          },
        },
        {
          name: 'bucket',
          type: 'text',
          admin: {
            description: 'S3 bucket name',
          },
        },
        {
          name: 'etag',
          type: 'text',
          admin: {
            description: 'S3 ETag for integrity verification',
          },
        },
        {
          name: 'lastModified',
          type: 'date',
          admin: {
            description: 'Last modified date in S3',
          },
        },
      ],
    },
    // Image sizes
    {
      name: 'sizes',
      type: 'group',
      fields: [
        {
          name: 'thumbnail',
          type: 'group',
          fields: [
            { name: 'url', type: 'text' },
            { name: 'cdnUrl', type: 'text' },
            { name: 'key', type: 'text' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
            { name: 'size', type: 'number' },
          ],
        },
        {
          name: 'medium',
          type: 'group',
          fields: [
            { name: 'url', type: 'text' },
            { name: 'cdnUrl', type: 'text' },
            { name: 'key', type: 'text' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
            { name: 'size', type: 'number' },
          ],
        },
        {
          name: 'large',
          type: 'group',
          fields: [
            { name: 'url', type: 'text' },
            { name: 'cdnUrl', type: 'text' },
            { name: 'key', type: 'text' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
            { name: 'size', type: 'number' },
          ],
        },
      ],
    },
    // File metadata
    {
      name: 'fileMetadata',
      type: 'group',
      fields: [
        {
          name: 'originalName',
          type: 'text',
          admin: {
            description: 'Original filename',
          },
        },
        {
          name: 'mimeType',
          type: 'text',
          admin: {
            description: 'MIME type of the file',
          },
        },
        {
          name: 'fileSize',
          type: 'number',
          admin: {
            description: 'File size in bytes',
          },
        },
        {
          name: 'width',
          type: 'number',
          admin: {
            description: 'Image width in pixels',
          },
        },
        {
          name: 'height',
          type: 'number',
          admin: {
            description: 'Image height in pixels',
          },
        },
      ],
    },
    // Storage configuration
    {
      name: 'storageConfig',
      type: 'group',
      fields: [
        {
          name: 'storageClass',
          type: 'select',
          options: [
            { label: 'Standard', value: 'STANDARD' },
            { label: 'Standard IA', value: 'STANDARD_IA' },
            { label: 'Glacier', value: 'GLACIER' },
            { label: 'Deep Archive', value: 'DEEP_ARCHIVE' },
          ],
          defaultValue: 'STANDARD',
          admin: {
            description: 'S3 storage class',
          },
        },
        {
          name: 'region',
          type: 'text',
          defaultValue: 'us-east-1',
          admin: {
            description: 'AWS region',
          },
        },
        {
          name: 'encryption',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: 'AES-256', value: 'AES256' },
            { label: 'AWS KMS', value: 'aws:kms' },
          ],
          defaultValue: 'AES256',
          admin: {
            description: 'Encryption method',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Set the uploadedBy field to the current user
        if (req.user) {
          data.uploadedBy = req.user.id
        }
        
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // If this is a new profile picture, deactivate other profile pictures for the same owner
        if (operation === 'create' && doc.ownerType && doc.ownerId) {
          try {
            await req.payload.update({
              collection: 'profile-pictures-cloud',
              where: {
                and: [
                  { ownerType: { equals: doc.ownerType } },
                  { ownerId: { equals: doc.ownerId } },
                  { id: { not_equals: doc.id } },
                ],
              },
              data: {
                isActive: false,
              },
            })
          } catch (error) {
            console.error('Error deactivating other profile pictures:', error)
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        // Delete files from S3 when record is deleted
        try {
          if (doc.cloudStorage?.key) {
            await profilePictureStorage.deleteFile(doc.cloudStorage.key)
          }
          
          // Delete size variants
          if (doc.sizes?.thumbnail?.key) {
            await profilePictureStorage.deleteFile(doc.sizes.thumbnail.key)
          }
          if (doc.sizes?.medium?.key) {
            await profilePictureStorage.deleteFile(doc.sizes.medium.key)
          }
          if (doc.sizes?.large?.key) {
            await profilePictureStorage.deleteFile(doc.sizes.large.key)
          }
        } catch (error) {
          console.error('Error deleting files from S3:', error)
        }
      },
    ],
  },
}

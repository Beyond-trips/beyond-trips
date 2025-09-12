// collections/ProfilePictures.ts
import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

// Add these lines to define dirname
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ProfilePictures: CollectionConfig = {
  slug: 'profile-pictures',
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
  upload: {
    staticDir: path.resolve(dirname, '../../media/profile-pictures'),
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    adminThumbnail: 'thumbnail',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 150,
        height: 150,
        position: 'centre',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 80,
          },
        },
      },
      {
        name: 'medium',
        width: 300,
        height: 300,
        position: 'centre',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 85,
          },
        },
      },
      {
        name: 'large',
        width: 600,
        height: 600,
        position: 'centre',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 90,
          },
        },
      },
    ],
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
    {
      name: 'fileSize',
      type: 'number',
      admin: {
        description: 'File size in bytes',
      },
    },
    {
      name: 'mimeType',
      type: 'text',
      admin: {
        description: 'MIME type of the uploaded file',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Set the uploadedBy field to the current user
        if (req.user) {
          data.uploadedBy = req.user.id
        }
        
        // Set file metadata if available
        if (req.file) {
          data.fileSize = req.file.size
          data.mimeType = req.file.mimetype
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
              collection: 'profile-pictures',
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
  },
}

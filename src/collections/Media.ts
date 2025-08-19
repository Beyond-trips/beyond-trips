// collections/Media.ts
import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

// Add these lines to define dirname
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'), // Points to project root/media
    mimeTypes: ['image/*', 'application/pdf', 'text/*'],
    adminThumbnail: 'thumbnail',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        console.log('📁 Media upload beforeChange:', { 
          filename: data?.filename, 
          mimeType: data?.mimeType,
          user: req.user?.email 
        })
        return data
      }
    ],
    afterChange: [
      ({ doc, req }) => {
        console.log('✅ Media upload afterChange:', { 
          id: doc.id, 
          filename: doc.filename,
          url: doc.url,
          user: req.user?.email 
        })
        return doc
      }
    ],
  },
}
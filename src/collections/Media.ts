// collections/Media.ts
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  upload: {
    // Files now upload directly to S3 via @payloadcms/storage-s3 plugin
    // Configuration is in payload.config.ts
    mimeTypes: [
      'image/*', 
      'application/pdf', 
      'text/*',
      'video/mp4',      // Campaign media
      'video/quicktime', // MOV
      'video/x-msvideo'  // AVI
    ],
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
    {
      name: 'usageType',
      type: 'select',
      options: [
        { label: 'Driver Document', value: 'driver_doc' },
        { label: 'Campaign Media', value: 'campaign_media' },
        { label: 'Profile Picture', value: 'profile_picture' },
        { label: 'Magazine QR Code', value: 'magazine_qr' },
        { label: 'Advertiser QR Code', value: 'advertiser_qr' },
        { label: 'General', value: 'general' },
      ],
      admin: {
        description: 'How this media is being used in the system',
      },
    },
    {
      name: 's3Url',
      type: 'text',
      admin: {
        description: 'S3 URL for this media file (preferred over local URL)',
      },
    },
    {
      name: 's3Key',
      type: 'text',
      admin: {
        description: 'S3 key for this media file',
      },
    },
    {
      name: 's3Bucket',
      type: 'text',
      admin: {
        description: 'S3 bucket name',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Auto-populate s3Url, s3Key, and s3Bucket fields for admin visibility
        // Only set on create operations when filename is available
        if (operation === 'create' && data?.filename && !data.s3Url) {
          const bucket = process.env.AWS_S3_BUCKET_GENERAL_MEDIA || 'beyond-trips-general-media'
          const region = process.env.AWS_REGION || 'us-east-1'
          const prefix = 'media'
          const s3Key = `${prefix}/${data.filename}`
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`
          
          // Set S3 fields directly in beforeChange to avoid recursion
          data.s3Url = s3Url
          data.s3Key = s3Key
          data.s3Bucket = bucket
          
          console.log('✅ Media upload beforeChange - S3 URL set:', { 
            filename: data.filename, 
            s3Url,
            s3Key,
            s3Bucket: bucket,
            user: req.user?.email 
          })
        }
        
        console.log('📁 Media upload beforeChange:', { 
          filename: data?.filename, 
          mimeType: data?.mimeType,
          user: req.user?.email 
        })
        
        return data
      }
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        console.log('✅ Media upload afterChange:', { 
          id: doc.id, 
          filename: doc.filename,
          url: doc.url,
          s3Url: (doc as any).s3Url,
          user: req.user?.email 
        })
        
        return doc
      }
    ],
  },
}
// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { nodemailerAdapter }  from '@payloadcms/email-nodemailer'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  cors: [
    'http://localhost:3000',
    'https://www.beyondtrips.uk',
    'https://www.google.com',
  ],
  csrf: ['https://www.beyondtrips.uk','http://localhost:3000','https://www.google.com'],
  // Admin config
  admin: {
    user: Users.slug,
    
    importMap: { baseDir: path.resolve(dirname) },
  },
  

  
  // Only one secret
  secret: process.env.PAYLOAD_SECRET || '',

  // Only one database adapter
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),

  // Server URL
  serverURL: process.env.PAYLOAD_SERVER_URL,

  // Email adapter
  email: nodemailerAdapter({
    defaultFromAddress: 'hello@beyondtrip.co.uk',
    defaultFromName:    'Beyond Trips',
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  }),

  // Collections, editor, plugins, etc.
  collections: [Users, Media],
  editor: lexicalEditor(),
  sharp,
  plugins: [payloadCloudPlugin()],

  // TypeScript output
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})

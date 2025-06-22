// create-admin.ts
import { getPayload } from 'payload'
import rawConfig from './src/payload.config'

// Cast to any so TS won’t infer “never”
const rawAny = rawConfig as any

// If your config export is a function, call it; otherwise it’s already the object
const baseConfig = typeof rawAny === 'function'
  ? rawAny()
  : rawAny

// Inject your secret directly (WARNING: don’t commit real secrets!)
const config = {
  ...baseConfig,
  secret: '8b5f3215c9bbabf1f49f54f0',
}

async function createAdmin() {
  // Initialize Payload
  const payload = await getPayload({ config })

  try {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: 'feniola07+admin@gmail.com' } },
    })

    if (docs.length) {
      console.log('⚠️  Admin already exists!')
      return process.exit(0)
    }

    await payload.create({
      collection: 'users',
      data: {
        email: 'feniola07+admin@gmail.com',
        password: 'admin',
        username: 'admin',
        role: 'admin',
        emailVerified: true,
      },
    })

    console.log('✅ Admin created!')
    console.log('📧 feniola07+admin@gmail.com')
    console.log('🔑 admin')
    console.log('🔗 /admin')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error creating admin:', err)
    process.exit(1)
  }
}

createAdmin()

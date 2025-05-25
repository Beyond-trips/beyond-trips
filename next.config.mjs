import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config
}

export default withPayload(nextConfig, {
  // Point to your config file
  configPath: './src/payload.config.ts'
})
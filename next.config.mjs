import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // You can add other options here if needed
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

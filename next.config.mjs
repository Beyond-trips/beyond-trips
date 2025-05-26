import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  // Experimental features
  experimental: {
    reactCompiler: false
  },
  
  // Other configurations
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization for production
  images: {
    domains: ['localhost'],
    // Add your production domains here
  },
}

export default withPayload(nextConfig)
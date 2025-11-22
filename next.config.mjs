import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  // Experimental features
  experimental: {
    reactCompiler: false
  },
  
  // TypeScript configuration
  typescript: {
    // ⚠️ Allow production builds to complete even with type errors
    // This is necessary because Payload generates types after the build
    ignoreBuildErrors: true,
  },
  
  // ESLint configuration
  eslint: {
    // Allow production builds to complete even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  
  // Other configurations
  reactStrictMode: true,
  
  // Image optimization for production
  images: {
    domains: ['localhost'],
    // Add your production domains here
  },
  
  // Static file serving for media uploads
  async rewrites() {
    return [
      {
        source: '/api/media/:path*',
        destination: '/api/media/:path*',
      },
      {
        source: '/media/:path*',
        destination: '/api/media/:path*',
      },
    ]
  },
  
  // Force CORS headers on all API routes
  async headers() {
    return [
      {
        // Apply to all API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS,PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Requested-With,Accept' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
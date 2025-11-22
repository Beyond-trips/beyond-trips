/**
 * Generate OpenAPI/Swagger spec for Beyond Trips API
 * Run: npm run generate:swagger
 * Output: openapi.json (ready for Postman import)
 */

import swaggerAutogen from 'swagger-autogen'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const doc = {
  info: {
    title: 'Beyond Trips API',
    description: 'Complete API documentation for Beyond Trips platform - Driver, Advertiser, Admin, and Rider endpoints',
    version: '1.0.0',
  },
  host: 'localhost:3000',
  basePath: '/api',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    { name: 'Driver Dashboard', description: 'Driver-facing endpoints' },
    { name: 'Advertiser Dashboard', description: 'Advertiser/Business endpoints' },
    { name: 'Admin Dashboard', description: 'Admin management endpoints' },
    { name: 'Rider', description: 'Rider/Passenger endpoints' },
    { name: 'QR Scanning', description: 'QR code scanning and tracking' },
    { name: 'Payments', description: 'Payment processing endpoints' },
    { name: 'Notifications', description: 'Notification system' },
    { name: 'Analytics', description: 'Analytics and reporting' },
    { name: 'Support', description: 'Support ticket system' },
    { name: 'Authentication', description: 'Auth and session management' },
  ],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Enter your bearer token in the format: Bearer <token>',
    },
  },
  security: [{ bearerAuth: [] }],
  definitions: {
    // Common schemas
    Error: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Error message' },
        error: { type: 'string' },
      },
    },
    Success: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  },
}

// All endpoint files to scan
const endpointFiles = [
  // Driver endpoints
  './src/endpoints/driverDashboardEndpoints.ts',
  './src/endpoints/driverMagazineActivationEndpoints.ts',
  './src/endpoints/driverNotificationEndpoints.ts',
  './src/endpoints/driverQRHistoryEndpoints.ts',
  './src/endpoints/driverRatingsEndpoints.ts',
  
  // Advertiser endpoints
  './src/endpoints/advertiserDashboardEndpoints.ts',
  './src/endpoints/advertiserQREndpoints.ts',
  
  // Admin endpoints
  './src/endpoints/adminDashboardEndpoints.ts',
  './src/endpoints/adminAdvancedEndpoints.ts',
  './src/endpoints/adminBankDetailsEndpoints.ts',
  './src/endpoints/adminCreativeApprovalEndpoints.ts',
  './src/endpoints/adminDriverEndpoints.ts',
  './src/endpoints/adminInvoiceEndpoints.ts',
  './src/endpoints/adminKycEndpoints.ts',
  './src/endpoints/adminMagazineEndpoints.ts',
  './src/endpoints/adminNotificationEndpoints.ts',
  './src/endpoints/adminPaymentGatewayEndpoints.ts',
  './src/endpoints/adminPickupLocationsEndpoints.ts',
  './src/endpoints/adminPremiumEndpoints.ts',
  './src/endpoints/adminRequestsEndpoints.ts',
  './src/endpoints/adminRolesEndpoints.ts',
  './src/endpoints/adminSettingsEndpoints.ts',
  './src/endpoints/adminSupportEndpoints.ts',
  './src/endpoints/adminWithdrawalEndpoints.ts',
  
  // Rider endpoints
  './src/endpoints/riderBTLCoinEndpoints.ts',
  
  // QR Scanning
  './src/endpoints/qrScanningEndpoints.ts',
  './src/endpoints/qrScanAnalyticsEndpoints.ts',
  
  // Payment endpoints
  './src/endpoints/paymentEndpoints.ts',
  './src/endpoints/stripePaymentEndpoints.ts',
  
  // Notification endpoints
  './src/endpoints/notificationServiceEndpoints.ts',
  './src/endpoints/notificationDeliveryFixes.ts',
  
  // Analytics
  './src/endpoints/analyticsExportEndpoints.ts',
  './src/endpoints/campaignStatusEndpoints.ts',
  
  // Support
  './src/endpoints/supportTicketEndpoints.ts',
  
  // Profile management
  './src/endpoints/profileManagementEndpoints.ts',
  './src/endpoints/profileCompletenessEndpoints.ts',
  './src/endpoints/profilePictureEndpoints.ts',
  './src/endpoints/profilePictureCloudEndpoints.ts',
  
  // Auth & User management
  './src/endpoints/partnerRegistration.ts',
  './src/endpoints/userVerification.ts',
  './src/endpoints/sessionManagementEndpoints.ts',
  './src/endpoints/userDataEndpoints.ts',
  './src/endpoints/gdprComplianceEndpoints.ts',
  
  // Misc
  './src/endpoints/polishEndpoints.ts',
]

const outputFile = join(__dirname, '..', 'openapi.json')

console.log('🔨 Generating OpenAPI/Swagger specification...')
console.log(`📁 Scanning ${endpointFiles.length} endpoint files`)
console.log(`📝 Output: ${outputFile}`)

swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointFiles, doc)
  .then(() => {
    console.log('✅ OpenAPI spec generated successfully!')
    console.log('\n📥 To import into Postman:')
    console.log('   1. Open Postman')
    console.log('   2. Click "Import" button')
    console.log('   3. Select the file: beyond-trips/openapi.json')
    console.log('   4. Postman will create a complete collection with all endpoints')
    console.log('\n💡 Tip: Set up environment variables for:')
    console.log('   - baseUrl (e.g., http://localhost:3000)')
    console.log('   - bearerToken (your JWT token)')
    console.log('   - driverEmail, advertiserEmail, adminEmail (for testing)')
  })
  .catch((err) => {
    console.error('❌ Error generating OpenAPI spec:', err)
    process.exit(1)
  })


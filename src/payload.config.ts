import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { S3Client } from '@aws-sdk/client-s3'
import path from 'path'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { SubscriptionPlans } from './collections/SubscriptionPlans'
import { BusinessDetails } from './collections/BusinessDetails'
import { AdCampaigns } from './collections/AdCampaigns'
import { PaymentBudgeting } from './collections/PaymentBudgeting'
import { UserDocuments } from './collections/UserDocuments'
import { UserBankDetails } from './collections/UserBankDetails'
import { UserTraining } from './collections/UserTraining'
import { UserOnboarding } from './collections/UserOnboarding'
import { Media } from './collections/Media'
import { DriverRatings } from './collections/DriverRatings'
import { DriverNotifications } from './collections/DriverNotifications'
import { DriverNotificationPreferences } from './collections/DriverNotificationPreferences'
import { AdvertiserNotifications } from './collections/AdvertiserNotifications'
import { AdminNotifications } from './collections/AdminNotifications'
import { DriverMagazines } from './collections/DriverMagazines'
import { DriverMagazineReads } from './collections/DriverMagazineReads'
import { DriverEarnings } from './collections/DriverEarnings'
import { DriverWithdrawals } from './collections/DriverWithdrawals'
import { CampaignPerformance } from './collections/CampaignPerformance'
import { CampaignMedia } from './collections/CampaignMedia'
import { Invoices } from './collections/Invoices'
import { AnalyticsData } from './collections/AnalyticsData'
import { ProfilePictures } from './collections/ProfilePictures'
import { ProfilePicturesCloud } from './collections/ProfilePicturesCloud'
import BankDetailsRequests from './collections/BankDetailsRequests'
import MagazinePickups from './collections/MagazinePickups'
import SystemSettings from './collections/SystemSettings'
import AdminRoles from './collections/AdminRoles'
import NotificationTemplates from './collections/NotificationTemplates'
import PaymentGatewayConfig from './collections/PaymentGatewayConfig'
import { DriverScans } from './collections/DriverScans'
import { AdvertiserQRCodes } from './collections/AdvertiserQRCodes'
import { QREngagements } from './collections/QREngagements'
import MagazinePickupLocations from './collections/MagazinePickupLocations'
import SupportTickets from './collections/SupportTickets'
import NotificationLogs from './collections/NotificationLogs'
import { BTLCoinAwards } from './collections/BTLCoinAwards'
import { UserSessions } from './collections/UserSessions'


import { 
  startPartnerRegistration,
  verifyEmail,
  resendVerificationCode,
  resendPartnerResetOTP,
  createAdCampaign,
  getSubscriptionPlans,
  setupPaymentBudgeting,
  completeRegistration,
  getRegistrationStatus
} from './endpoints/partnerRegistration'

import {
  generateUserOTP,
  updateUserProfile,
  verifyUserOTP,
  resendUserOTP,
  getUserOnboardingStatus,
  uploadUserDocuments,
  saveUserBankDetails,
  completeUserTraining,
  completeUserOnboarding,
  userForgotPassword,
  userResetPassword,
  verifyUserPasswordResetOTP

} from './endpoints/userVerification'

import {
  getPendingDriverRegistrations,
  approveDriverRegistration,
  rejectDriverRegistration
} from './endpoints/adminDriverEndpoints'

import {
  activateMagazine,
  getDriverMagazines
} from './endpoints/driverMagazineActivationEndpoints'

import {
  getAllPickupLocations,
  getPickupLocationById,
  createPickupLocation,
  updatePickupLocation,
  deletePickupLocation,
  updateLocationStock
} from './endpoints/adminPickupLocationsEndpoints'

import {
  setActiveEdition,
  getDriverMetricsForAdmin
} from './endpoints/adminMagazineEndpoints'

import {
  getPendingDocuments,
  getDocumentDetails,
  verifyDocument,
  rejectDocument,
  markDocumentUnderReview,
  getKycStats
} from './endpoints/adminKycEndpoints'

import {
  getPendingCreatives,
  getCreativeDetails,
  approveCreative,
  rejectCreative,
  markCreativeUnderReview,
  getCreativeApprovalStats
} from './endpoints/adminCreativeApprovalEndpoints'

import {
  exportWithdrawalsToCSV,
  exportWithdrawalsToPDF,
  bulkCompleteWithdrawals
} from './endpoints/adminWithdrawalEndpoints'

import {
  getAllInvoices,
  confirmOfflinePayment,
  exportInvoicesToCSV,
  exportInvoicesToPDF
} from './endpoints/adminInvoiceEndpoints'

import {
  getAllDriverRequests,
  getRequestStats,
  approveDriverRequest,
  rejectDriverRequest
} from './endpoints/adminRequestsEndpoints'

import {
  initializeDefaultSettings,
  getSystemConfigSummary
} from './endpoints/adminSettingsEndpoints'

import {
  getDriverRequestHistory
} from './endpoints/driverDashboardEndpoints'

import {
  getAdvertiserCreatives,
  getCreativeStatus
} from './endpoints/advertiserDashboardEndpoints'

import {
  submitSupportTicket,
  getUserSupportTickets,
  getSupportTicketDetails,
  addTicketResponse
} from './endpoints/supportTicketEndpoints'

import {
  getAllSupportTickets,
  getSupportTicketStats,
  assignTicket,
  addAdminResponse,
  resolveTicket,
  updateTicketStatus
} from './endpoints/adminSupportEndpoints'

import {
  exportPersonalData,
  requestDataDeletion,
  getDataDeletionRequests,
  processDataDeletion
} from './endpoints/gdprComplianceEndpoints'


const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  cors: [
    'http://localhost:3000',
    'https://www.beyondtrips.uk',
    'https://www.google.com',
    'https://beyond-trips-backend2.onrender.com', // Production domain
  ],
  csrf: [
    'https://www.beyondtrips.uk',
    'http://localhost:3000',
    'https://www.google.com',
    'https://beyond-trips-backend2.onrender.com', // Production domain
  ],
  
  // Cookie configuration for production
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // Allow cookies in cross-site requests
  },
  
  admin: {
    user: Users.slug,
    importMap: { 
      baseDir: path.resolve(dirname) 
    },
  },
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          disableLocalStorage: true,
        },
        'profile-pictures': {
          prefix: 'profile-pictures',
          disableLocalStorage: true,
        },
      },
      bucket: process.env.AWS_S3_BUCKET_GENERAL_MEDIA || 'beyond-trips-general-media',
      config: new S3Client({
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
        region: process.env.AWS_REGION || 'us-east-1',
      }),
    }),
  ],
  collections: [
    Users,
    Media,
    BusinessDetails,
    AdCampaigns,
    PaymentBudgeting,
    SubscriptionPlans,
    // Media collection for business logos, campaign images, etc.
    UserDocuments,
    UserBankDetails,
    UserTraining,
    UserOnboarding,
    DriverEarnings,
    DriverWithdrawals,
    DriverRatings,
    BTLCoinAwards,
    DriverNotifications,
    DriverNotificationPreferences,
    AdvertiserNotifications,
    AdminNotifications,
    DriverMagazines,
    DriverMagazineReads,
    CampaignPerformance,
    CampaignMedia,
    Invoices,
    AnalyticsData,
    ProfilePictures,
    ProfilePicturesCloud,
    BankDetailsRequests,
    MagazinePickups,
    SystemSettings,
    AdminRoles,
    NotificationTemplates,
    PaymentGatewayConfig,
    DriverScans,
    AdvertiserQRCodes,
    QREngagements,
    MagazinePickupLocations,
    SupportTickets,
    NotificationLogs,
    UserSessions,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
  }),
  
  endpoints: [
    // Partner Registration Endpoints
    {
      path: '/partner/register',
      method: 'post',
      handler: startPartnerRegistration,
    },
    {
      path: '/partner/verify-email',
      method: 'post',
      handler: verifyEmail,
    },
    {
      path: '/partner/resend-code',
      method: 'post',
      handler: resendPartnerResetOTP,
    },
    {
      path: '/partner/resendPartnerResetOTP',
      method: 'post',
      handler: resendVerificationCode,
    },
    {
      path: '/partner/create-campaign',
      method: 'post',
      handler: createAdCampaign,
    },
    {
      path: '/partner/subscription-plans',
      method: 'get',
      handler: getSubscriptionPlans,
    },
    {
      path: '/partner/setup-payment',
      method: 'post',
      handler: setupPaymentBudgeting,
    },
    {
      path: '/partner/complete',
      method: 'post',
      handler: completeRegistration,
    },
    {
      path: '/partner/status/:id',
      method: 'get',
      handler: getRegistrationStatus,
    },
    
    // User Verification Endpoints
    {
      path: '/user/generate-otp',
      method: 'post',
      handler: generateUserOTP,
    },
    {
      path: '/user/verify-otp',
      method: 'post',
      handler: verifyUserOTP,
    },
    {
      path: '/user/resend-otp',
      method: 'post',
      handler: resendUserOTP,
    },
    {
      path: '/user/forgot-password-otp',
      method: 'post',
      handler: userForgotPassword,
    },
    {
      path: '/user/verify-reset-otp',
      method: 'post',
      handler: verifyUserPasswordResetOTP,
    },
    {
      path: '/user/reset-password',
      method: 'post',
      handler: userResetPassword,
    },
    
    
    // User Onboarding Endpoints
    {
      path: '/user/onboarding/status',
      method: 'get',
      handler: getUserOnboardingStatus,
    },
    {
      path: '/user/onboarding/documents',
      method: 'post',
      handler: uploadUserDocuments,
    },
    {
      path: '/user/onboarding/bank-details',
      method: 'post',
      handler: saveUserBankDetails,
    },
    {
      path: '/user/onboarding/training',
      method: 'post',
      handler: completeUserTraining,
    },
    {
      path: '/user/onboarding/complete',
      method: 'post',
      handler: completeUserOnboarding,
    },
    // User Onboarding Endpoints (5-step driver onboarding flow)
    {
      path: '/user/onboarding/status',
      method: 'get',
      handler: getUserOnboardingStatus,
    },
    {
      path: '/user/onboarding/profile',
      method: 'post',
      handler: updateUserProfile,
    },
    {
      path: '/user/onboarding/documents',
      method: 'post',
      handler: uploadUserDocuments,
    },
    {
      path: '/user/onboarding/bank-details',
      method: 'post',
      handler: saveUserBankDetails,
    },
    {
      path: '/user/onboarding/training',
      method: 'post',
      handler: completeUserTraining,
    },
    {
      path: '/user/onboarding/complete',
      method: 'post',
      handler: completeUserOnboarding,
    },
    
    // Admin Driver Registration Approval Endpoints
    {
      path: '/admin/drivers',
      method: 'get',
      handler: getPendingDriverRegistrations,
    },
    {
      path: '/admin/drivers/:userId/approve-registration',
      method: 'post',
      handler: approveDriverRegistration,
    },
    {
      path: '/admin/drivers/:userId/reject-registration',
      method: 'post',
      handler: rejectDriverRegistration,
    },
    
    // Driver Magazine Activation Endpoints
    {
      path: '/driver/activate-magazine',
      method: 'post',
      handler: activateMagazine,
    },
    {
      path: '/driver/my-magazines',
      method: 'get',
      handler: getDriverMagazines,
    },
    
    // Admin Pickup Locations Management Endpoints
    {
      path: '/admin/magazine-locations',
      method: 'get',
      handler: getAllPickupLocations,
    },
    {
      path: '/admin/magazine-locations/:id',
      method: 'get',
      handler: getPickupLocationById,
    },
    {
      path: '/admin/magazine-locations',
      method: 'post',
      handler: createPickupLocation,
    },
    {
      path: '/admin/magazine-locations/:id',
      method: 'put',
      handler: updatePickupLocation,
    },
    {
      path: '/admin/magazine-locations/:id',
      method: 'delete',
      handler: deletePickupLocation,
    },
    {
      path: '/admin/magazine-locations/:id/stock',
      method: 'patch',
      handler: updateLocationStock,
    },
    
    // Admin Magazine Edition Management
    {
      path: '/admin/magazines/:id/set-active',
      method: 'post',
      handler: setActiveEdition,
    },
    {
      path: '/admin/drivers/:driverId/metrics',
      method: 'get',
      handler: getDriverMetricsForAdmin,
    },
    
    // Admin KYC Document Verification Endpoints
    {
      path: '/admin/kyc/documents',
      method: 'get',
      handler: getPendingDocuments,
    },
    {
      path: '/admin/kyc/documents/:id',
      method: 'get',
      handler: getDocumentDetails,
    },
    {
      path: '/admin/kyc/documents/:id/verify',
      method: 'post',
      handler: verifyDocument,
    },
    {
      path: '/admin/kyc/documents/:id/reject',
      method: 'post',
      handler: rejectDocument,
    },
    {
      path: '/admin/kyc/documents/:id/review',
      method: 'post',
      handler: markDocumentUnderReview,
    },
    {
      path: '/admin/kyc/stats',
      method: 'get',
      handler: getKycStats,
    },
    
    // Admin Creative Approval Endpoints
    {
      path: '/admin/creatives',
      method: 'get',
      handler: getPendingCreatives,
    },
    {
      path: '/admin/creatives/:id',
      method: 'get',
      handler: getCreativeDetails,
    },
    {
      path: '/admin/creatives/:id/approve',
      method: 'post',
      handler: approveCreative,
    },
    {
      path: '/admin/creatives/:id/reject',
      method: 'post',
      handler: rejectCreative,
    },
    {
      path: '/admin/creatives/:id/review',
      method: 'post',
      handler: markCreativeUnderReview,
    },
    {
      path: '/admin/creatives/stats',
      method: 'get',
      handler: getCreativeApprovalStats,
    },
    
    // Admin Withdrawal Export & Completion Endpoints
    {
      path: '/admin/withdrawals/export/csv',
      method: 'get',
      handler: exportWithdrawalsToCSV,
    },
    {
      path: '/admin/withdrawals/export/pdf',
      method: 'get',
      handler: exportWithdrawalsToPDF,
    },
    {
      path: '/admin/withdrawals/bulk-complete',
      method: 'post',
      handler: bulkCompleteWithdrawals,
    },
    
    // Admin Invoice Management Endpoints
    {
      path: '/admin/invoices',
      method: 'get',
      handler: getAllInvoices,
    },
    {
      path: '/admin/invoices/confirm-payment',
      method: 'post',
      handler: confirmOfflinePayment,
    },
    {
      path: '/admin/invoices/export/csv',
      method: 'get',
      handler: exportInvoicesToCSV,
    },
    {
      path: '/admin/invoices/export/pdf',
      method: 'get',
      handler: exportInvoicesToPDF,
    },
    
    // Admin Unified Requests Endpoints
    {
      path: '/admin/requests',
      method: 'get',
      handler: getAllDriverRequests,
    },
    {
      path: '/admin/requests/stats',
      method: 'get',
      handler: getRequestStats,
    },
    {
      path: '/admin/requests/approve',
      method: 'post',
      handler: approveDriverRequest,
    },
    {
      path: '/admin/requests/reject',
      method: 'post',
      handler: rejectDriverRequest,
    },
    
    // Admin System Configuration Endpoints
    {
      path: '/admin/settings/initialize-defaults',
      method: 'post',
      handler: initializeDefaultSettings,
    },
    {
      path: '/admin/settings/config-summary',
      method: 'get',
      handler: getSystemConfigSummary,
    },
    
    // Driver Request History Endpoint
    {
      path: '/driver/request-history',
      method: 'get',
      handler: getDriverRequestHistory,
    },
    
    // Advertiser Creative Status Endpoints
    {
      path: '/advertiser/creatives',
      method: 'get',
      handler: getAdvertiserCreatives,
    },
    {
      path: '/advertiser/creatives/:id',
      method: 'get',
      handler: getCreativeStatus,
    },
    
    // Support Ticket Endpoints (Driver & Advertiser)
    {
      path: '/support/tickets',
      method: 'post',
      handler: submitSupportTicket,
    },
    {
      path: '/support/tickets',
      method: 'get',
      handler: getUserSupportTickets,
    },
    {
      path: '/support/tickets/:id',
      method: 'get',
      handler: getSupportTicketDetails,
    },
    {
      path: '/support/tickets/:id/respond',
      method: 'post',
      handler: addTicketResponse,
    },
    
    // Admin Support Ticket Management
    {
      path: '/admin/support/tickets',
      method: 'get',
      handler: getAllSupportTickets,
    },
    {
      path: '/admin/support/stats',
      method: 'get',
      handler: getSupportTicketStats,
    },
    {
      path: '/admin/support/assign',
      method: 'post',
      handler: assignTicket,
    },
    {
      path: '/admin/support/:id/respond',
      method: 'post',
      handler: addAdminResponse,
    },
    {
      path: '/admin/support/resolve',
      method: 'post',
      handler: resolveTicket,
    },
    {
      path: '/admin/support/update-status',
      method: 'post',
      handler: updateTicketStatus,
    },
    
    // GDPR Compliance Endpoints
    {
      path: '/users/me/export-data',
      method: 'get',
      handler: exportPersonalData,
    },
    {
      path: '/users/me/request-deletion',
      method: 'post',
      handler: requestDataDeletion,
    },
    {
      path: '/admin/gdpr/deletion-requests',
      method: 'get',
      handler: getDataDeletionRequests,
    },
    {
      path: '/admin/gdpr/process-deletion',
      method: 'post',
      handler: processDataDeletion,
    },
  ],
})
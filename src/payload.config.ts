import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { uploadthingStorage } from '@payloadcms/storage-uploadthing'
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


const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  cors: [
    'http://localhost:3000',
    'https://www.beyondtrips.uk',
    'https://www.google.com',
  ],
  csrf: ['https://www.beyondtrips.uk','http://localhost:3000','https://www.google.com'],
  
  admin: {
    user: Users.slug,
    importMap: { 
      baseDir: path.resolve(dirname) 
    },
  },
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
    
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
  }),
  plugins: [
    uploadthingStorage({
      collections: {
        media: true,
      },
      options: {
        token: process.env.UPLOADTHING_SECRET,
        acl: 'public-read',
      },
    }),
  ],
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
  ],
})
// ===== src/lib/api/validators.ts =====
// Zod schemas for input validation
import { z } from 'zod'

// Partner registration schema - all data in one request
export const partnerRegistrationSchema = z.object({
  // Business details
  companyEmail: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Company name is too short'),
  companyAddress: z.string().min(5, 'Please provide a valid address'),
  contact: z.string().min(10, 'Contact number must be at least 10 digits'),
  industry: z.string().min(2, 'Please specify your industry'),
  
  // Campaign selection
  campaign: z.object({
    type: z.enum(['magazine', 'digital', 'qr_engagement']),
    name: z.string().optional(),
    description: z.string().optional()
  }),
  
  // Payment selection
  subscription: z.object({
    planType: z.enum(['starter', 'standard', 'pro']),
    paymentMethod: z.enum(['card', 'bank_transfer', 'mobile_money'])
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// User onboarding schema - all steps in one
export const userOnboardingSchema = z.object({
  // Personal info
  firstName: z.string().min(2, 'First name is too short'),
  lastName: z.string().min(2, 'Last name is too short'),
  phoneNumber: z.string().min(10, 'Invalid phone number'),
  address: z.string().min(5, 'Please provide a valid address'),
  references: z.string().optional(),
  
  // Documents
  documents: z.array(z.object({
    type: z.enum(['drivers_license', 'national_id', 'vehicle_registration']),
    mediaId: z.string()
  })).min(3, 'All documents are required'),
  
  // Bank details
  bankDetails: z.object({
    bankName: z.string(),
    accountName: z.string().min(2),
    accountNumber: z.string().length(10, 'Account number must be 10 digits')
  }),
  
  // Training confirmation
  training: z.object({
    termsAccepted: z.boolean().refine(val => val === true, 'You must accept terms'),
    videosCompleted: z.array(z.string()).optional()
  })
})

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  type: z.enum(['user', 'partner']).optional().default('user')
})

// OTP verification schema
export const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits')
})

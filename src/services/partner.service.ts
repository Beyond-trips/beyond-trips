// ===== PHASE 1.2: IMPLEMENT SERVICES =====

// src/services/partner.service.ts
// All partner business logic in one place
import { Payload } from 'payload'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendOTPEmail } from '@/lib/email'
import { generateAuthToken } from '@/lib/auth'
import { ErrorCodes } from '@/lib/api/errors'
import mongoose from 'mongoose'

export class PartnerService {
  constructor(private payload: Payload) {}

  /**
   * Complete partner registration in one transaction
   * This replaces: startPartnerRegistration, verifyEmail, createAdCampaign, 
   * setupPaymentBudgeting, and completeRegistration
   */
  async registerPartner(data: any) {
    // Start a database transaction to ensure all-or-nothing
    const session = await mongoose.startSession()
    
    try {
      await session.withTransaction(async () => {
        // Step 1: Check if email already exists
        const existing = await this.payload.find({
          collection: 'business-details',
          where: {
            companyEmail: { equals: data.companyEmail.toLowerCase() }
          },
          limit: 1
        })

        if (existing.docs.length > 0) {
          throw {
            code: ErrorCodes.DUPLICATE_ENTRY,
            message: 'Email already registered'
          }
        }

        // Step 2: Create business account
        const hashedPassword = await bcrypt.hash(data.password, 12)
        const verificationCode = crypto.randomInt(100000, 999999).toString()
        
        const business = await this.payload.create({
          collection: 'business-details',
          data: {
            companyEmail: data.companyEmail.toLowerCase(),
            password: hashedPassword,
            companyName: data.companyName,
            companyAddress: data.companyAddress,
            contact: data.contact,
            industry: data.industry,
            emailVerified: false,
            verificationCode,
            verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
            registrationStatus: 'pending'
          }
        })

        // Step 3: Create ad campaign
        const campaign = await this.payload.create({
          collection: 'ad-campaigns',
          data: {
            businessId: business.id,
            campaignType: data.campaign.type,
            campaignName: data.campaign.name || `${data.campaign.type} Campaign`,
            campaignDescription: data.campaign.description || '',
            status: 'draft'
          }
        })

        // Step 4: Get subscription plan details
        const plans = await this.payload.find({
          collection: 'subscription-plans',
          where: {
            planType: { equals: data.subscription.planType },
            isActive: { equals: true }
          },
          limit: 1
        })

        if (plans.docs.length === 0) {
          throw {
            code: ErrorCodes.PLAN_NOT_FOUND,
            message: 'Selected subscription plan not found'
          }
        }

        const plan = plans.docs[0]

        // Step 5: Create payment record
        const payment = await this.payload.create({
          collection: 'payment-budgeting',
          data: {
            businessId: business.id,
            pricingTier: data.subscription.planType,
            monthlyBudget: plan.price || 0,
            paymentMethod: data.subscription.paymentMethod,
            paymentStatus: 'pending',
            subscriptionStartDate: new Date(),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        })

        // Step 6: Send verification email (outside transaction for performance)
        await sendOTPEmail(data.companyEmail, verificationCode)

        return {
          business,
          campaign,
          payment,
          verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined
        }
      })
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      await session.endSession()
    }
  }

  /**
   * Verify OTP and complete registration
   */
  async verifyAndComplete(businessId: string, otp: string) {
    // Get business
    const business = await this.payload.findByID({
      collection: 'business-details',
      id: businessId
    })

    if (!business) {
      throw {
        code: ErrorCodes.BUSINESS_NOT_FOUND,
        message: 'Business not found'
      }
    }

    // Check if already verified
    if (business.emailVerified) {
      throw {
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'Email already verified'
      }
    }

    // Verify OTP
    if (business.verificationCode !== otp) {
      throw {
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid verification code'
      }
    }

    // Check expiry
    if (new Date(business.verificationCodeExpiry) < new Date()) {
      throw {
        code: ErrorCodes.TOKEN_EXPIRED,
        message: 'Verification code has expired'
      }
    }

    // Update business
    await this.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
        registrationStatus: 'completed'
      }
    })

    // Generate auth token
    const token = generateAuthToken({
      id: business.id,
      email: business.companyEmail,
      type: 'partner',
      companyName: business.companyName
    })

    return {
      token,
      business: {
        id: business.id,
        email: business.companyEmail,
        companyName: business.companyName
      }
    }
  }

  /**
   * Get partner dashboard data
   */
  async getDashboardData(partnerId: string) {
    const [business, campaigns, payment] = await Promise.all([
      this.payload.findByID({
        collection: 'business-details',
        id: partnerId
      }),
      this.payload.find({
        collection: 'ad-campaigns',
        where: { businessId: { equals: partnerId } }
      }),
      this.payload.find({
        collection: 'payment-budgeting',
        where: { businessId: { equals: partnerId } },
        limit: 1
      })
    ])

    return {
      business,
      campaigns: campaigns.docs,
      payment: payment.docs[0] || null
    }
  }
}

// src/app/api/v1/partners/route.ts
// New consolidated partner endpoint
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PartnerService } from '@/services/partner.service'
import { APIResponse, parseRequest, validateData } from '@/lib/api/base'
import { partnerRegistrationSchema } from '@/lib/api/validators'
import { ErrorCodes, getErrorMessage } from '@/lib/api/errors'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const service = new PartnerService(payload)
    const body = await parseRequest(req)
    const { action, data } = body

    switch (action) {
      // Register new partner (replaces 5 endpoints)
      case 'register': {
        // Validate input
        const validation = validateData(partnerRegistrationSchema, data)
        if (!validation.success) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Invalid registration data',
            400,
            validation.errors
          )
        }

        try {
          const result = await service.registerPartner(validation.data)
          return APIResponse.success({
            businessId: result.business.id,
            message: 'Registration successful. Please check your email for verification code.',
            requiresVerification: true,
            ...(process.env.NODE_ENV === 'development' && { 
              verificationCode: result.verificationCode 
            })
          })
        } catch (error: any) {
          if (error.code) {
            return APIResponse.error(
              error.code,
              error.message || getErrorMessage(error.code),
              error.code === ErrorCodes.DUPLICATE_ENTRY ? 409 : 400
            )
          }
          throw error
        }
      }

      // Verify OTP and complete registration
      case 'verify': {
        const { businessId, verificationCode } = data
        
        if (!businessId || !verificationCode) {
          return APIResponse.error(
            ErrorCodes.MISSING_REQUIRED_FIELD,
            'Business ID and verification code are required',
            400
          )
        }

        try {
          const result = await service.verifyAndComplete(businessId, verificationCode)
          return APIResponse.success({
            token: result.token,
            business: result.business,
            message: 'Registration completed successfully!'
          })
        } catch (error: any) {
          if (error.code) {
            return APIResponse.error(
              error.code,
              error.message || getErrorMessage(error.code),
              400
            )
          }
          throw error
        }
      }

      // Get partner dashboard data (requires auth)
      case 'dashboard': {
        const user = await getAuthUser(req)
        if (!user || user.type !== 'partner') {
          return APIResponse.error(
            ErrorCodes.UNAUTHORIZED,
            'Partner authentication required',
            401
          )
        }

        const dashboardData = await service.getDashboardData(user.id)
        return APIResponse.success(dashboardData)
      }

      default:
        return APIResponse.error(
          ErrorCodes.INVALID_FORMAT,
          `Unknown action: ${action}`,
          400
        )
    }
  } catch (error: any) {
    console.error('Partner API error:', error)
    return APIResponse.error(
      ErrorCodes.INTERNAL_ERROR,
      getErrorMessage(ErrorCodes.INTERNAL_ERROR),
      500,
      process.env.NODE_ENV === 'development' ? error.message : undefined
    )
  }
}

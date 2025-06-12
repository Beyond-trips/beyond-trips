// src/app/api/v1/users/route.ts
// New consolidated user endpoint
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { UserService } from '@/services/user.service'
import { APIResponse, parseRequest, validateData } from '@/lib/api/base'
import { userOnboardingSchema, otpSchema } from '@/lib/api/validators'
import { ErrorCodes, getErrorMessage } from '@/lib/api/errors'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const service = new UserService(payload)
    const body = await parseRequest(req)
    const { action, data } = body

    switch (action) {
      // Register new user
      case 'register': {
        const { email, password, username } = data

        if (!email || !password || !username) {
          return APIResponse.error(
            ErrorCodes.MISSING_REQUIRED_FIELD,
            'Email, password, and username are required',
            400
          )
        }

        try {
          const result = await service.registerUser({ email, password, username })
          return APIResponse.success(result)
        } catch (error: any) {
          // Handle Payload duplicate key errors
          if (error.message?.includes('duplicate')) {
            return APIResponse.error(
              ErrorCodes.DUPLICATE_ENTRY,
              'Email or username already exists',
              409
            )
          }
          throw error
        }
      }

      // Verify OTP
      case 'verify': {
        const validation = validateData(otpSchema, data)
        if (!validation.success) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Invalid verification data',
            400,
            validation.errors
          )
        }

        try {
          const result = await service.verifyOTP(validation.data.email, validation.data.otp)
          return APIResponse.success(result)
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

      // Complete onboarding (replaces 5 endpoints)
      case 'onboard': {
        const user = await getAuthUser(req)
        if (!user || user.type !== 'user') {
          return APIResponse.error(
            ErrorCodes.UNAUTHORIZED,
            'User authentication required',
            401
          )
        }

        const validation = validateData(userOnboardingSchema, data)
        if (!validation.success) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Invalid onboarding data',
            400,
            validation.errors
          )
        }

        try {
          const result = await service
          // This line appears incomplete. Likely you meant:
          // const result = await service.completeOnboarding(user.id, validation.data)
          // return APIResponse.success(result)
        } 

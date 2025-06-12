// src/app/api/v1/auth/[action]/route.ts
// Consolidated auth endpoint for both users and partners
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { APIResponse, parseRequest, validateData } from '@/lib/api/base'
import { loginSchema } from '@/lib/api/validators'
import { ErrorCodes, getErrorMessage } from '@/lib/api/errors'
import { generateAuthToken, verifyAuthToken, getTokenFromRequest } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const payload = await getPayload({ config })
    const { action } = params
    const body = await parseRequest(req)

    switch (action) {
      // Login (replaces loginPartner and Payload's login)
      case 'login': {
        const validation = validateData(loginSchema, body)
        if (!validation.success) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Invalid login data',
            400,
            validation.errors
          )
        }

        const { email, password, type } = validation.data

        if (type === 'partner') {
          // Partner login
          const partners = await payload.find({
            collection: 'business-details',
            where: { companyEmail: { equals: email.toLowerCase() } },
            limit: 1
          })

          if (partners.docs.length === 0) {
            return APIResponse.error(
              ErrorCodes.INVALID_CREDENTIALS,
              getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
              401
            )
          }

          const partner = partners.docs[0]

          // Check verification
          if (!partner.emailVerified) {
            return APIResponse.error(
              ErrorCodes.EMAIL_NOT_VERIFIED,
              getErrorMessage(ErrorCodes.EMAIL_NOT_VERIFIED),
              403
            )
          }

          // Verify password
          const isValid = await bcrypt.compare(password, partner.password)
          if (!isValid) {
            return APIResponse.error(
              ErrorCodes.INVALID_CREDENTIALS,
              getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
              401
            )
          }

          // Update last login
          await payload.update({
            collection: 'business-details',
            id: partner.id,
            data: { lastLogin: new Date().toISOString() }
          })

          const token = generateAuthToken({
            id: partner.id,
            email: partner.companyEmail,
            type: 'partner',
            companyName: partner.companyName
          })

          return APIResponse.success({
            token,
            user: {
              id: partner.id,
              email: partner.companyEmail,
              companyName: partner.companyName,
              type: 'partner'
            }
          })
        } else {
          // User login - use Payload's auth
          try {
            const result = await payload.login({
              collection: 'users',
              data: { email, password }
            })

            const user = result.user
            if (!user.emailVerified) {
              return APIResponse.error(
                ErrorCodes.EMAIL_NOT_VERIFIED,
                getErrorMessage(ErrorCodes.EMAIL_NOT_VERIFIED),
                403
              )
            }

            const token = generateAuthToken({
              id: user.id,
              email: user.email,
              type: 'user',
              role: user.role
            })

            return APIResponse.success({
              token,
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                type: 'user'
              }
            })
          } catch (error) {
            return APIResponse.error(
              ErrorCodes.INVALID_CREDENTIALS,
              getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
              401
            )
          }
        }
      }

      // Logout
      case 'logout': {
        const token = getTokenFromRequest(req)
        if (token) {
          const user = verifyAuthToken(token)
          if (user && user.type === 'partner') {
            await payload.update({
              collection: 'business-details',
              id: user.id,
              data: { lastLogout: new Date().toISOString() }
            })
          }
        }
        return APIResponse.success({ message: 'Logged out successfully' })
      }

      // Forgot password (replaces forgotPassword and userForgotPassword)
      case 'forgot-password': {
        const { email, type = 'user' } = body

        if (!email) {
          return APIResponse.error(
            ErrorCodes.MISSING_REQUIRED_FIELD,
            'Email is required',
            400
          )
        }

        // Always return success to prevent email enumeration
        if (type === 'partner') {
          const partners = await payload.find({
            collection: 'business-details',
            where: { companyEmail: { equals: email.toLowerCase() } },
            limit: 1
          })

          if (partners.docs.length > 0) {
            const partner = partners.docs[0]
            const resetToken = crypto.randomBytes(32).toString('hex')
            
            await payload.update({
              collection: 'business-details',
              id: partner.id,
              data: {
                passwordResetToken: resetToken,
                passwordResetExpiry: new Date(Date.now() + 3600000).toISOString()
              }
            })

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&type=partner`
            await sendPasswordResetEmail(email, resetUrl, partner.companyName)
          }
        } else {
          const users = await payload.find({
            collection: 'users',
            where: { email: { equals: email.toLowerCase() } },
            limit: 1
          })

          if (users.docs.length > 0) {
            const user = users.docs[0]
            const resetToken = crypto.randomBytes(32).toString('hex')
            
            await payload.update({
              collection: 'users',
              id: user.id,
              data: {
                passwordResetToken: resetToken,
                passwordResetExpiry: new Date(Date.now() + 3600000).toISOString()
              }
            })

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&type=user`
            await sendPasswordResetEmail(email, resetUrl, user.firstName || 'User')
          }
        }

        return APIResponse.success({
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }

      // Reset password (replaces resetPassword and userResetPassword)
      case 'reset-password': {
        const { token, password, confirmPassword } = body

        if (!token || !password || !confirmPassword) {
          return APIResponse.error(
            ErrorCodes.MISSING_REQUIRED_FIELD,
            'All fields are required',
            400
          )
        }

        if (password !== confirmPassword) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Passwords do not match',
            400
          )
        }

        // Check partners first
        const partners = await payload.find({
          collection: 'business-details',
          where: {
            and: [
              { passwordResetToken: { equals: token } },
              { passwordResetExpiry: { greater_than: new Date() } }
            ]
          },
          limit: 1
        })

        if (partners.docs.length > 0) {
          const partner = partners.docs[0]
          const hashedPassword = await bcrypt.hash(password, 12)
          
          await payload.update({
            collection: 'business-details',
            id: partner.id,
            data: {
              password: hashedPassword,
              passwordResetToken: null,
              passwordResetExpiry: null,
              passwordChangedAt: new Date().toISOString()
            }
          })

          return APIResponse.success({
            message: 'Password reset successfully'
          })
        }

        // Check users
        const users = await payload.find({
          collection: 'users',
          where: {
            and: [
              { passwordResetToken: { equals: token } },
              { passwordResetExpiry: { greater_than: new Date() } }
            ]
          },
          limit: 1
        })

        if (users.docs.length > 0) {
          const user = users.docs[0]
          
          await payload.update({
            collection: 'users',
            id: user.id,
            data: {
              password: password, // Payload will hash it
              passwordResetToken: null,
              passwordResetExpiry: null,
              passwordChangedAt: new Date().toISOString()
            }
          })

          return APIResponse.success({
            message: 'Password reset successfully'
          })
        }

        return APIResponse.error(
          ErrorCodes.TOKEN_EXPIRED,
          'Invalid or expired reset token',
          400
        )
      }

      default:
        return APIResponse.error(
          ErrorCodes.INVALID_FORMAT,
          `Unknown action: ${action}`,
          404
        )
    }
  } catch (error: any) {
    console.error('Auth API error:', error)
    return APIResponse.error(
      ErrorCodes.INTERNAL_ERROR,
      getErrorMessage(ErrorCodes.INTERNAL_ERROR),
      500,
      process.env.NODE_ENV === 'development' ? error.message : undefined
    )
  }
}.registerPartner(validation.data)
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
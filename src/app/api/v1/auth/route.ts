// src/app/api/v1/auth/[action]/route.ts
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { APIResponse, parseRequest } from '@/lib/api/base'
import { ErrorCodes } from '@/lib/api/errors'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const payload = await getPayload({ config })
    const data = await parseRequest(req)
    const { action } = params

    switch (action) {
      case 'login': {
        const { email, password, type = 'user' } = data
        
        if (type === 'partner') {
          // Partner login
          const partners = await payload.find({
            collection: 'business-details',
            where: { companyEmail: { equals: email } }
          })

          if (!partners.docs.length) {
            return APIResponse.error(
              ErrorCodes.INVALID_CREDENTIALS,
              'Invalid credentials',
              401
            )
          }

          const partner = partners.docs[0]
          
          // Verify password
          const isValid = await bcrypt.compare(password, partner.password)
          if (!isValid) {
            return APIResponse.error(
              ErrorCodes.INVALID_CREDENTIALS,
              'Invalid credentials',
              401
            )
          }

          const token = jwt.sign(
            { id: partner.id, email: partner.companyEmail, role: 'partner' },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
          )

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
          // User login - use Payload's built-in auth
          const result = await payload.login({
            collection: 'users',
            data: { email, password }
          })

          return APIResponse.success({
            token: result.token,
            user: result.user
          })
        }
      }

      case 'logout': {
        // Handle logout if needed
        return APIResponse.success({
          message: 'Logged out successfully'
        })
      }

      case 'forgot-password': {
        const { email, type = 'user' } = data
        
        // Generate reset token and send email
        // Implementation depends on your email service
        
        return APIResponse.success({
          message: 'If an account exists, a reset link has been sent'
        })
      }

      case 'reset-password': {
        const { token, password, confirmPassword } = data
        
        if (password !== confirmPassword) {
          return APIResponse.error(
            ErrorCodes.VALIDATION_FAILED,
            'Passwords do not match',
            400
          )
        }

        // Reset password logic
        
        return APIResponse.success({
          message: 'Password reset successfully'
        })
      }

      default:
        return APIResponse.error(
          ErrorCodes.VALIDATION_FAILED,
          `Unknown action: ${action}`,
          404
        )
    }
  } catch (error: any) {
    console.error('Auth API error:', error)
    return APIResponse.error(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500
    )
  }
}
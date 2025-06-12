// ===== src/lib/auth.ts =====
// Authentication utilities
import jwt from 'jsonwebtoken'
import type { PayloadRequest } from 'payload'

export interface AuthToken {
  id: string
  email: string
  type: 'user' | 'partner'
  role?: string
  companyName?: string
}

// Generate JWT token
export function generateAuthToken(data: AuthToken): string {
  return jwt.sign(data, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  })
}

// Verify JWT token
export function verifyAuthToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as AuthToken
  } catch (error) {
    return null
  }
}

// Extract token from request
export function getTokenFromRequest(req: PayloadRequest | Request): string | null {
  let authHeader: string | null = null
  
  // Handle PayloadRequest
  if ('headers' in req && req.headers.get) {
    authHeader = req.headers.get('authorization')
  }
  // Handle regular Request
  else if (req.headers instanceof Headers) {
    authHeader = req.headers.get('authorization')
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  return authHeader.replace('Bearer ', '')
}

// Get authenticated user from request
export async function getAuthUser(req: PayloadRequest | Request): Promise<AuthToken | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  
  return verifyAuthToken(token)
}
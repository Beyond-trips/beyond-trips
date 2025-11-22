// utilities/requestHelpers.ts
// Shared helper functions for request handling

import type { PayloadRequest } from 'payload'

/**
 * Helper function to parse request body
 */
export const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.json && typeof req.json === 'function') {
      return await req.json()
    }
    if (req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream)) {
      return req.body
    }
    if (req.body instanceof ReadableStream) {
      const reader = req.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      const bodyText = new TextDecoder().decode(combined)
      return JSON.parse(bodyText)
    }
    return req.body
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

/**
 * Helper function to check admin access
 */
export const checkAdminAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check if user is admin
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({
      error: 'Forbidden - Admin access required'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // TODO: Add strict role check in production
  return null
}

/**
 * Safely get URL object from request
 * Returns null if req.url is undefined, otherwise returns URL object
 */
export const getRequestUrl = (req: PayloadRequest): URL | null => {
  if (!req.url) {
    return null
  }
  return new URL(req.url)
}

/**
 * Safely get URL object from request or return error response
 * Returns error Response if req.url is undefined, otherwise returns URL object
 */
export const getRequestUrlOrError = (req: PayloadRequest): URL | Response => {
  if (!req.url) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return new URL(req.url)
}

/**
 * Ensure user is not null after checkAdminAccess
 * Returns error response if user is null, otherwise returns null (success)
 */
export const ensureUserNotNull = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return null
}


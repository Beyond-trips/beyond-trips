// src/lib/api/base.ts - Shared utilities
export class APIResponse<T = any> {
    success: boolean
    data?: T
    error?: {
      code: string
      message: string
      details?: any
    }
    meta?: {
      timestamp: string
      version: string
    }
  
    static success<T>(data: T): Response {
      return new Response(JSON.stringify({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  
    static error(code: string, message: string, status = 400, details?: any): Response {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code,
          message,
          details
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  // Shared request parser
  export async function parseRequest(req: Request): Promise<any> {
    try {
      const contentType = req.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return await req.json()
      }
      return {}
    } catch (error) {
      throw new Error('Invalid request body')
    }
  }
  
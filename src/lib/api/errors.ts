// ===== src/lib/api/errors.ts =====
// Standardized error codes for the entire application
export enum ErrorCodes {
    // Authentication errors (AUTH)
    INVALID_CREDENTIALS = 'AUTH001',
    TOKEN_EXPIRED = 'AUTH002',
    UNAUTHORIZED = 'AUTH003',
    EMAIL_NOT_VERIFIED = 'AUTH004',
    
    // Validation errors (VAL)
    VALIDATION_FAILED = 'VAL001',
    DUPLICATE_ENTRY = 'VAL002',
    MISSING_REQUIRED_FIELD = 'VAL003',
    INVALID_FORMAT = 'VAL004',
    
    // Business logic errors (BIZ)
    REGISTRATION_INCOMPLETE = 'BIZ001',
    PAYMENT_FAILED = 'BIZ002',
    PLAN_NOT_FOUND = 'BIZ003',
    BUSINESS_NOT_FOUND = 'BIZ004',
    
    // System errors (SYS)
    INTERNAL_ERROR = 'SYS001',
    DATABASE_ERROR = 'SYS002',
    EMAIL_SERVICE_ERROR = 'SYS003',
    
    // Rate limiting (RATE)
    TOO_MANY_REQUESTS = 'RATE001'
  }
// Helper to get user-friendly message for error codes
export function getErrorMessage(code: ErrorCodes): string {
    const messages: Record<ErrorCodes, string> = {
      [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid email or password',
      [ErrorCodes.TOKEN_EXPIRED]: 'Your session has expired. Please log in again',
      [ErrorCodes.UNAUTHORIZED]: 'You are not authorized to access this resource',
      [ErrorCodes.EMAIL_NOT_VERIFIED]: 'Please verify your email before continuing',
      
      [ErrorCodes.VALIDATION_FAILED]: 'Please check your input and try again',
      [ErrorCodes.DUPLICATE_ENTRY]: 'This email is already registered',
      [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields',
      [ErrorCodes.INVALID_FORMAT]: 'Invalid data format',
      
      [ErrorCodes.REGISTRATION_INCOMPLETE]: 'Please complete your registration',
      [ErrorCodes.PAYMENT_FAILED]: 'Payment processing failed',
      [ErrorCodes.PLAN_NOT_FOUND]: 'Selected plan not found',
      [ErrorCodes.BUSINESS_NOT_FOUND]: 'Business account not found',
      
      [ErrorCodes.INTERNAL_ERROR]: 'Something went wrong. Please try again',
      [ErrorCodes.DATABASE_ERROR]: 'Database error occurred',
      [ErrorCodes.EMAIL_SERVICE_ERROR]: 'Failed to send email',
      
      [ErrorCodes.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later'
    }
    
    return messages[code] || 'An error occurred'
  }
    
import Stripe from 'stripe'

// Initialize Stripe with API key
const stripeApiKey = process.env.STRIPE_SECRET_KEY

if (!stripeApiKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY not configured - payment features will be limited')
}

export const stripe = new Stripe(stripeApiKey || 'sk_test_dummy', {
  apiVersion: '2024-04-10' as any, // Type assertion to bypass strict version checking
})

// Stripe webhook secret for verifying webhook signatures
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Get publishable key for frontend
export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

// Stripe configuration constants
export const stripeConfig = {
  apiVersion: '2024-04-10' as const,
  maxNetworkRetries: 3,
  timeout: 30000,
}

// Test card numbers for testing
export const testCards = {
  visa: '4242424242424242',
  mastercard: '5555555555554444',
  amex: '378282246310005',
  declinedCard: '4000000000000002',
}

export default stripe

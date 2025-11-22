import type { CollectionConfig } from 'payload'

const PaymentGatewayConfig: CollectionConfig = {
  slug: 'payment-gateway-config',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'provider', 'isActive', 'lastValidated', 'updatedAt'],
    group: 'Payment Management',
    description: 'Payment gateway configuration and credentials',
  },
  access: {
    // Only admins can manage payment gateways
    read: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || (user as any).role === 'super-admin'
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || (user as any).role === 'super-admin'
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || (user as any).role === 'super-admin'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || (user as any).role === 'super-admin'
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Gateway name for identification (e.g., "Flutterwave Production")',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'Flutterwave', value: 'flutterwave' },
        { label: 'Paystack', value: 'paystack' },
        { label: 'PayPal', value: 'paypal' },
        { label: 'Stripe', value: 'stripe' },
      ],
      admin: {
        description: 'Payment service provider',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable/disable this gateway for payments',
      },
    },
    {
      name: 'environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
      defaultValue: 'sandbox',
      admin: {
        description: 'Whether this is production or sandbox/test credentials',
      },
    },
    {
      name: 'apiKey',
      type: 'text',
      required: true,
      admin: {
        description: 'API Key or Public Key for the gateway',
        placeholder: 'Enter your API key (will be encrypted)',
      },
    },
    {
      name: 'apiSecret',
      type: 'text',
      required: true,
      admin: {
        description: 'Secret key for the gateway (will be encrypted)',
        placeholder: 'Enter your secret key',
      },
    },
    {
      name: 'webhookUrl',
      type: 'text',
      admin: {
        description: 'Webhook URL for payment notifications',
        placeholder: 'https://yourdomain.com/api/webhooks/payment',
      },
    },
    {
      name: 'webhookSecret',
      type: 'text',
      admin: {
        description: 'Secret key for webhook validation (if applicable)',
      },
    },
    {
      name: 'settings',
      type: 'json',
      admin: {
        description: 'Provider-specific settings (e.g., timeout, retry count)',
      },
    },
    {
      name: 'supportedCurrencies',
      type: 'array',
      fields: [
        {
          name: 'currency',
          type: 'text',
        },
      ],
      defaultValue: [
        { currency: 'NGN' },
        { currency: 'USD' },
        { currency: 'GBP' },
      ],
      admin: {
        description: 'Currencies supported by this gateway',
      },
    },
    {
      name: 'supportedMethods',
      type: 'array',
      fields: [
        {
          name: 'method',
          type: 'select',
          options: [
            { label: 'Card', value: 'card' },
            { label: 'Bank Transfer', value: 'bank_transfer' },
            { label: 'USSD', value: 'ussd' },
            { label: 'QR Code', value: 'qr_code' },
            { label: 'Digital Wallet', value: 'digital_wallet' },
          ],
        },
      ],
      defaultValue: [
        { method: 'card' },
        { method: 'bank_transfer' },
      ],
      admin: {
        description: 'Payment methods supported by this gateway',
      },
    },
    {
      name: 'transactionFee',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: {
        description: 'Transaction fee percentage (e.g., 2.5 for 2.5%)',
      },
    },
    {
      name: 'minimumAmount',
      type: 'number',
      defaultValue: 100,
      min: 0,
      admin: {
        description: 'Minimum transaction amount in base currency unit',
      },
    },
    {
      name: 'maximumAmount',
      type: 'number',
      defaultValue: 999999,
      min: 0,
      admin: {
        description: 'Maximum transaction amount in base currency unit',
      },
    },
    {
      name: 'dailyLimit',
      type: 'number',
      admin: {
        description: 'Daily transaction limit (optional)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Additional notes or configuration details',
      },
    },
    {
      name: 'lastValidated',
      type: 'date',
      admin: {
        description: 'Last time credentials were tested and validated',
      },
    },
    {
      name: 'validationStatus',
      type: 'select',
      options: [
        { label: 'Not Tested', value: 'not_tested' },
        { label: 'Valid', value: 'valid' },
        { label: 'Invalid', value: 'invalid' },
        { label: 'Error', value: 'error' },
      ],
      defaultValue: 'not_tested',
      admin: {
        description: 'Status of the last credential validation',
      },
    },
    {
      name: 'validationError',
      type: 'textarea',
      admin: {
        description: 'Error details from last validation attempt',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Higher priority gateways are used first (0-100)',
      },
    },
  ],
  timestamps: true,
}

export default PaymentGatewayConfig

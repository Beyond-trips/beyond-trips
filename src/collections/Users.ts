import payload from 'payload';
import type { CollectionConfig, Payload } from 'payload';


export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },

  auth: {
    // Disable Payload’s built‐in “click‐this‐link” verify
    verify: false,
    // (We block login below in the hooks section)
  },

  access: {
    create: () => true,
    read: ({ req }) => !!req.user,
    update: ({ req, id }) => req.user?.id === id,
    delete: ({ req }) => req.user?.role === 'admin',
  },

  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'user',
      options: [
        { label: 'User',  value: 'user' },
        { label: 'Admin', value: 'admin' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'username',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'emailConfirmed',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true },
    },
    {
      name: 'emailOTP',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'emailOTPExpires',
      type: 'date',
      admin: { readOnly: true },
    },
    // (Payload automatically injects a “password” field under auth)
  ],

  hooks: {
    // 1) Generate a 6‐digit OTP + expiry before saving a new user
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'create') {
          const otp = String(Math.floor(100000 + Math.random() * 900000));
          data.emailOTP = otp;
          data.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
          // leave emailConfirmed = false until they verify
        }
      },
    ],

    // 2) After the new user is written, send the OTP email
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create' && doc.email && doc.emailOTP) {
          try {
            await req.payload.sendEmail({
              to: doc.email,
              subject: 'Your 6-digit verification code',
              html: `
                <p>Hi ${doc.username},</p>
                <p>Your verification code is: <strong>${doc.emailOTP}</strong></p>
                <p>This code will expire in 10 minutes.</p>
              `,
            });
          } catch (err) {
            console.error('Failed to send OTP email:', err);
          }
        }
      },
    ],
    // 3) Prevent login until emailConfirmed is true
    beforeLogin: [
      async ({ user }) => {
        if (!user.emailConfirmed) {
          throw new Error('Please verify your email before logging in.');
        }
      },
    ],
  },
};

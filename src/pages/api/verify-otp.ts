// src/pages/api/verify-otp.ts
import payload from 'payload';

import type { NextApiRequest, NextApiResponse } from 'next';
import initPayload from 'payload';

type VerifyOtpRequest = {
  email: string;
  otp: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, otp } = req.body as VerifyOtpRequest;

  try {
    // ─── 1) Initialize Payload ───────────────────────────────────────────
    // Make sure your .env provides PAYLOAD_SECRET and DATABASE_URI
    const payload = await initPayload({
      secret: process.env.PAYLOAD_SECRET!,
      mongoURL: process.env.DATABASE_URI!,
      local: true, // Only for local development; omit in production/Render
    });

    // ─── 2) Look up the user by email ────────────────────────────────────
    const findResult = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    });
    const user = findResult.docs?.[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ─── 3) Check OTP match and non‐expiration ───────────────────────────
    const expiresAt = user.emailOTPExpires
      ? new Date(user.emailOTPExpires).getTime()
      : 0;
    if (user.emailOTP !== otp || expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // ─── 4) Mark emailConfirmed = true and clear OTP fields ─────────────
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        emailConfirmed: true,
        emailOTP: '',
        emailOTPExpires: null,
      },
    });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error: any) {
    console.error('verify-otp error:', error);
    return res
      .status(500)
      .json({ message: 'Something went wrong', error: error.message });
  }
}

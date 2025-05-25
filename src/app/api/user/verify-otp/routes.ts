

// src/app/api/user/verify-otp/route.ts
import { verifyUserOTP } from '@/endpoints/userVerification'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  
  const payloadReq = {
    payload,
    json: () => req.json(),
    body: req.body,
    url: req.url,
  } as any
  
  return await verifyUserOTP(payloadReq)
}

// ---



// src/app/api/user/resend-otp/route.ts
import { resendUserOTP } from '@/endpoints/userVerification'
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
  
  return await resendUserOTP(payloadReq)
}
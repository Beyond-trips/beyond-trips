// src/app/api/user/generate-otp/route.ts
import { generateUserOTP } from '@/endpoints/userVerification'
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
  
  return await generateUserOTP(payloadReq)
}

// ---


// src/app/api/partner/register/route.ts
import { startPartnerRegistration } from '@/endpoints/partnerRegistration'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  
  // Create PayloadRequest-like object
  const payloadReq = {
    payload,
    json: () => req.json(),
    body: req.body,
    url: req.url,
  } as any
  
  return await startPartnerRegistration(payloadReq)
}

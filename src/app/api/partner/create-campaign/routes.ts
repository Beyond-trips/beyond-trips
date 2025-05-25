// src/app/api/partner/create-campaign/route.ts
import { createAdCampaign } from '@/endpoints/partnerRegistration'
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
  
  return await createAdCampaign(payloadReq)
}
// src/app/api/partner/subscription-plans/route.ts
import { getSubscriptionPlans } from '@/endpoints/partnerRegistration'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  
  const payloadReq = {
    payload,
    url: req.url,
  } as any
  
  return await getSubscriptionPlans(payloadReq)
}
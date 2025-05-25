// src/app/api/partner/setup-payment/route.ts
import { setupPaymentBudgeting } from '@/endpoints/partnerRegistration'
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
  
  return await setupPaymentBudgeting(payloadReq)
}

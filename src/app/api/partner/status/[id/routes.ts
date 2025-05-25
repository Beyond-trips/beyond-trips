// src/app/api/partner/status/[id]/route.ts
import { getRegistrationStatus } from '@/endpoints/partnerRegistration'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const payload = await getPayload({ config })
  
  // Modify URL to include the ID
  const url = new URL(req.url)
  url.pathname = `/api/partner/status/${params.id}`
  
  const payloadReq = {
    payload,
    url: url.toString(),
  } as any
  
  return await getRegistrationStatus(payloadReq)
}

// app/api/advertiser-dashboard/route.ts

import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getAdvertiserDashboardOverview,
  getAdvertiserProfile,
  getCampaigns,
  createCampaign,
  getAnalytics,
  getAdSpendData,
  generateReport,
  addAnalyticsData,
  uploadCampaignMediaFile,
  uploadProfilePicture
} from '../../../endpoints/advertiserDashboardEndpoints'
import { 
  uploadProfilePictureV2,
  getProfilePicture,
  deleteProfilePicture
} from '../../../endpoints/profilePictureEndpoints'
import {
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  updateCampaignStatus,
  getCampaignStatusHistory
} from '../../../endpoints/campaignStatusEndpoints'
import {
  processPayment,
  getPaymentStatus,
  handlePaymentCallback,
  getPaymentHistory
} from '../../../endpoints/paymentEndpoints'
import {
  changePassword,
  getProfile,
  updateProfile,
  uploadProfilePicture as uploadProfilePictureV3,
  deleteProfilePicture as deleteProfilePictureV3
} from '../../../endpoints/profileManagementEndpoints'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // Try Payload CMS authentication first
    let authResult = await payload.auth({ headers: req.headers })
    let user = authResult.user

    // If Payload auth fails, try partner JWT authentication
    if (!user) {
      const authHeader = req.headers.get('authorization')
      console.log('🔍 Auth header:', authHeader)
      if (authHeader && authHeader.startsWith('JWT ')) {
        const token = authHeader.substring(4)
        console.log('🔍 Token:', token.substring(0, 50) + '...')
        try {
          const jwt = require('jsonwebtoken')
          const decoded = jwt.verify(token, '096fcad00254ab7e247c1a34cbfa901d5a5b0b32e86e7144afbfd113cecd7a7b97b0040163132e732e87c9dc1efc09549b0db84d9aa86045a7b63d94b969cfc3')
          console.log('🔍 Decoded token:', decoded)
          
          if (decoded.role === 'partner' && decoded.partnerId) {
            console.log('🔍 Looking up business details for partnerId:', decoded.partnerId)
            // Find the business details for this partner
            const businessDetails = await payload.findByID({
              collection: 'business-details',
              id: decoded.partnerId
            })
            console.log('🔍 Business details found:', !!businessDetails)
            
            if (businessDetails) {
              // Create a mock user object for partner authentication
              user = {
                id: businessDetails.id,
                email: businessDetails.companyEmail,
                role: 'partner',
                partnerId: businessDetails.id,
                companyName: businessDetails.companyName,
                companyEmail: businessDetails.companyEmail
              }
              console.log('🔍 Created mock user:', user)
            }
          }
        } catch (error) {
          console.error('Partner JWT verification failed:', error)
        }
      }
    }

    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse optional body for GET requests
    let body = {}
    try {
      body = await req.json()
    } catch (error) {
      // Body parsing is optional for GET requests
    }

    const payloadRequest: any = {
      user: user,
      payload,
      url: req.url,
      body,
      headers: req.headers,
    }

    switch (action) {
      case 'overview':
        return await getAdvertiserDashboardOverview(payloadRequest)
      
      case 'profile':
        return await getAdvertiserProfile(payloadRequest)
      
      case 'campaigns':
        return await getCampaigns(payloadRequest)
      
      case 'analytics':
        return await getAnalytics(payloadRequest)
      
      case 'ad-spend-data':
        return await getAdSpendData(payloadRequest)
      
      case 'get-profile-picture':
        return await getProfilePicture(payloadRequest)
      
      case 'get-campaign-status-history':
        return await getCampaignStatusHistory(payloadRequest)
      
      case 'get-payment-status':
        return await getPaymentStatus(payloadRequest)
      
      case 'get-payment-history':
        return await getPaymentHistory(payloadRequest)
      
      case 'payment-callback':
        return await handlePaymentCallback(payloadRequest)
      
      case 'get-profile':
        return await getProfile(payloadRequest)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action parameter'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Advertiser dashboard GET error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // Try Payload CMS authentication first
    let authResult = await payload.auth({ headers: req.headers })
    let user = authResult.user

    // If Payload auth fails, try partner JWT authentication
    if (!user) {
      const authHeader = req.headers.get('authorization')
      console.log('🔍 Auth header:', authHeader)
      if (authHeader && authHeader.startsWith('JWT ')) {
        const token = authHeader.substring(4)
        console.log('🔍 Token:', token.substring(0, 50) + '...')
        try {
          const jwt = require('jsonwebtoken')
          const decoded = jwt.verify(token, '096fcad00254ab7e247c1a34cbfa901d5a5b0b32e86e7144afbfd113cecd7a7b97b0040163132e732e87c9dc1efc09549b0db84d9aa86045a7b63d94b969cfc3')
          console.log('🔍 Decoded token:', decoded)
          
          if (decoded.role === 'partner' && decoded.partnerId) {
            console.log('🔍 Looking up business details for partnerId:', decoded.partnerId)
            // Find the business details for this partner
            const businessDetails = await payload.findByID({
              collection: 'business-details',
              id: decoded.partnerId
            })
            console.log('🔍 Business details found:', !!businessDetails)
            
            if (businessDetails) {
              // Create a mock user object for partner authentication
              user = {
                id: businessDetails.id,
                email: businessDetails.companyEmail,
                role: 'partner',
                partnerId: businessDetails.id,
                companyName: businessDetails.companyName,
                companyEmail: businessDetails.companyEmail
              }
              console.log('🔍 Created mock user:', user)
            }
          }
        } catch (error) {
          console.error('Partner JWT verification failed:', error)
        }
      }
    }

    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please log in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await req.json()

    const payloadRequest: any = {
      user: user,
      payload,
      url: req.url,
      body,
      headers: req.headers,
    }

    switch (action) {
      case 'create-campaign':
        return await createCampaign(payloadRequest)
      
      case 'generate-report':
        return await generateReport(payloadRequest)
      
      case 'add-analytics-data':
        return await addAnalyticsData(payloadRequest)
      
      case 'upload-campaign-media':
        return await uploadCampaignMediaFile(payloadRequest)
      
      case 'upload-profile-picture':
        return await uploadProfilePicture(payloadRequest)
      
      case 'upload-profile-picture-v2':
        return await uploadProfilePictureV2(payloadRequest)
      
      case 'delete-profile-picture':
        return await deleteProfilePicture(payloadRequest)
      
      case 'pause-campaign':
        return await pauseCampaign(payloadRequest)
      
      case 'resume-campaign':
        return await resumeCampaign(payloadRequest)
      
      case 'cancel-campaign':
        return await cancelCampaign(payloadRequest)
      
      case 'update-campaign-status':
        return await updateCampaignStatus(payloadRequest)
      
      case 'process-payment':
        return await processPayment(payloadRequest)
      
      case 'change-password':
        return await changePassword(payloadRequest)
      
      case 'update-profile':
        return await updateProfile(payloadRequest)
      
      case 'upload-profile-picture-v3':
        return await uploadProfilePictureV3(payloadRequest)
      
      case 'delete-profile-picture-v3':
        return await deleteProfilePictureV3(payloadRequest)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action parameter'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('❌ Advertiser dashboard POST error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

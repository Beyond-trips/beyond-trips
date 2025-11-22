// endpoints/profilePictureEndpoints.ts
import type { PayloadRequest } from 'payload'

// Helper function to parse request body
const parseRequestBody = async (req: PayloadRequest): Promise<any> => {
  try {
    if (req.body && typeof req.body === 'object') {
      return req.body
    }
    return {}
  } catch (error) {
    console.error('Error parsing request body:', error)
    return {}
  }
}

// Helper function to check advertiser access
const checkAdvertiserAccess = (user: any): Response | null => {
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized - Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check if user has access to advertiser dashboard
  // Only allow partners and admins, block regular users (drivers)
  if (user.role === 'user') {
    return new Response(JSON.stringify({
      error: 'Access denied - Advertiser dashboard is only available for business partners and administrators'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}

// Upload profile picture using ProfilePictures collection
export const uploadProfilePictureV2 = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('📸 Uploading profile picture using ProfilePictures collection')

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Get business details for alt text
    const businessDetails = await req.payload.findByID({
      collection: 'business-details',
      id: businessId
    })

    // Create profile picture record in ProfilePictures collection
    const profilePicture = await req.payload.create({
      collection: 'profile-pictures' as any,
      data: {
        alt: `${businessDetails.companyName} Profile Picture`,
        caption: `Profile picture for ${businessDetails.companyName}`,
        ownerType: 'business',
        ownerId: businessId,
        isActive: true,
        uploadedBy: user!.id
      } as any,
      file: req.file // This will be handled by Payload's file upload system
    })

    // Update business profile with reference to the profile picture
    const updatedProfile = await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: profilePicture.url,
        profilePictureId: profilePicture.id,
        profilePictureUpdatedAt: new Date().toISOString()
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        id: profilePicture.id,
        url: profilePicture.url,
        thumbnail: profilePicture.sizes?.thumbnail?.url,
        medium: profilePicture.sizes?.medium?.url,
        large: profilePicture.sizes?.large?.url,
        alt: profilePicture.alt,
        caption: profilePicture.caption,
        ownerType: profilePicture.ownerType,
        ownerId: profilePicture.ownerId,
        isActive: profilePicture.isActive,
        fileSize: profilePicture.fileSize,
        mimeType: profilePicture.mimeType,
        uploadedAt: profilePicture.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload profile picture V2 error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload profile picture'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get profile picture for a business
export const getProfilePicture = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const businessId = searchParams.get('businessId')

    console.log('📸 Getting profile picture for business:', businessId || 'current')

    // For partner authentication, use the user.id directly as businessId
    let targetBusinessId = user!.id
    
    // If specific businessId is provided, use it (for admin access)
    if (businessId) {
      targetBusinessId = businessId
    }
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner' && !businessId) {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        targetBusinessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Get active profile picture for the business
    const profilePictures = await req.payload.find({
      collection: 'profile-pictures' as any,
      where: {
        and: [
          { ownerType: { equals: 'business' } },
          { ownerId: { equals: targetBusinessId } },
          { isActive: { equals: true } }
        ]
      },
      sort: '-createdAt',
      limit: 1
    })

    if (profilePictures.docs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No profile picture found',
        data: null
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const profilePicture = profilePictures.docs[0]

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: profilePicture.id,
        url: profilePicture.url,
        thumbnail: profilePicture.sizes?.thumbnail?.url,
        medium: profilePicture.sizes?.medium?.url,
        large: profilePicture.sizes?.large?.url,
        alt: profilePicture.alt,
        caption: profilePicture.caption,
        ownerType: profilePicture.ownerType,
        ownerId: profilePicture.ownerId,
        isActive: profilePicture.isActive,
        fileSize: profilePicture.fileSize,
        mimeType: profilePicture.mimeType,
        uploadedAt: profilePicture.createdAt,
        uploadedBy: profilePicture.uploadedBy
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get profile picture error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get profile picture'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete profile picture
export const deleteProfilePicture = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { profilePictureId } = body

    if (!profilePictureId) {
      return new Response(JSON.stringify({
        error: 'Profile picture ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🗑️ Deleting profile picture:', profilePictureId)

    // Get the profile picture to verify ownership
    const profilePicture = await req.payload.findByID({
      collection: 'profile-pictures' as any,
      id: profilePictureId
    })

    // For partner authentication, use the user.id directly as businessId
    let businessId = user!.id
    
    // For regular Payload CMS users, look up by email
    if ((user as any).role !== 'partner') {
      const advertiser = await req.payload.find({
        collection: 'business-details',
        where: { companyEmail: { equals: user!.email } },
        limit: 1
      })

      if (advertiser.docs.length > 0) {
        businessId = advertiser.docs[0].id
      } else {
        return new Response(JSON.stringify({
          error: 'Business profile not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Verify ownership
    if (profilePicture.ownerType !== 'business' || profilePicture.ownerId !== businessId) {
      return new Response(JSON.stringify({
        error: 'Profile picture not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete the profile picture
    await req.payload.delete({
      collection: 'profile-pictures' as any,
      id: profilePictureId
    })

    // Update business profile to remove profile picture reference
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: null,
        profilePictureId: null,
        profilePictureUpdatedAt: new Date().toISOString()
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete profile picture error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete profile picture'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

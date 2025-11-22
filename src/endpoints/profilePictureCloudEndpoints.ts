// endpoints/profilePictureCloudEndpoints.ts
import type { PayloadRequest } from 'payload'
import { profilePictureStorage } from '../config/cloudStorage'
import sharp from 'sharp'

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

// Upload profile picture using cloud storage
export const uploadProfilePictureCloud = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('☁️ Uploading profile picture using cloud storage')

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

    // Get file from request
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return new Response(JSON.stringify({
        error: 'No file provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({
        error: 'Invalid file type. Only JPEG, PNG, and GIF images are allowed.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({
        error: 'File too large. Maximum size is 2MB.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get image metadata
    const metadata = await sharp(buffer).metadata()

    // Upload to cloud storage with multiple sizes
    const uploadResult = await profilePictureStorage.uploadImageWithSizes(
      buffer,
      file.name,
      file.type,
      'profile-pictures',
      [
        { name: 'thumbnail', width: 150, height: 150 },
        { name: 'medium', width: 300, height: 300 },
        { name: 'large', width: 600, height: 600 }
      ]
    )

    // Create profile picture record in ProfilePicturesCloud collection
    const profilePicture = await req.payload.create({
      collection: 'profile-pictures-cloud' as any,
      data: {
        alt: `${businessDetails.companyName} Profile Picture`,
        caption: `Profile picture for ${businessDetails.companyName}`,
        ownerType: 'business',
        ownerId: businessId,
        isActive: true,
        uploadedBy: user!.id,
        cloudStorage: {
          url: uploadResult.url,
          cdnUrl: uploadResult.cdnUrl,
          key: uploadResult.key,
          bucket: uploadResult.bucket,
          etag: uploadResult.etag,
          lastModified: uploadResult.lastModified
        },
        sizes: {
          thumbnail: {
            url: uploadResult.sizes.thumbnail?.url,
            cdnUrl: uploadResult.sizes.thumbnail?.cdnUrl,
            key: uploadResult.sizes.thumbnail?.key,
            width: 150,
            height: 150,
            size: uploadResult.sizes.thumbnail?.size
          },
          medium: {
            url: uploadResult.sizes.medium?.url,
            cdnUrl: uploadResult.sizes.medium?.cdnUrl,
            key: uploadResult.sizes.medium?.key,
            width: 300,
            height: 300,
            size: uploadResult.sizes.medium?.size
          },
          large: {
            url: uploadResult.sizes.large?.url,
            cdnUrl: uploadResult.sizes.large?.cdnUrl,
            key: uploadResult.sizes.large?.key,
            width: 600,
            height: 600,
            size: uploadResult.sizes.large?.size
          }
        },
        fileMetadata: {
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          width: metadata.width,
          height: metadata.height
        },
        storageConfig: {
          storageClass: 'STANDARD',
          region: 'us-east-1',
          encryption: 'AES256'
        }
      } as any
    })

    // Update business profile with reference to the profile picture
    const updatedProfile = await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: uploadResult.cdnUrl || uploadResult.url,
        profilePictureId: profilePicture.id,
        profilePictureUpdatedAt: new Date().toISOString()
      } as any
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture uploaded successfully to cloud storage',
      data: {
        id: profilePicture.id,
        url: uploadResult.url,
        cdnUrl: uploadResult.cdnUrl,
        sizes: {
          thumbnail: uploadResult.sizes.thumbnail?.cdnUrl || uploadResult.sizes.thumbnail?.url,
          medium: uploadResult.sizes.medium?.cdnUrl || uploadResult.sizes.medium?.url,
          large: uploadResult.sizes.large?.cdnUrl || uploadResult.sizes.large?.url
        },
        alt: profilePicture.alt,
        caption: profilePicture.caption,
        ownerType: profilePicture.ownerType,
        ownerId: profilePicture.ownerId,
        isActive: profilePicture.isActive,
        fileSize: file.size,
        mimeType: file.type,
        width: metadata.width,
        height: metadata.height,
        uploadedAt: profilePicture.createdAt,
        cloudStorage: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          etag: uploadResult.etag
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload profile picture cloud error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload profile picture to cloud storage'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get profile picture from cloud storage
export const getProfilePictureCloud = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { searchParams } = new URL(req.url || '')
    const businessId = searchParams.get('businessId')

    console.log('☁️ Getting profile picture from cloud storage for business:', businessId || 'current')

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
      collection: 'profile-pictures-cloud' as any,
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
        url: profilePicture.cloudStorage?.url,
        cdnUrl: profilePicture.cloudStorage?.cdnUrl,
        sizes: {
          thumbnail: profilePicture.sizes?.thumbnail?.cdnUrl || profilePicture.sizes?.thumbnail?.url,
          medium: profilePicture.sizes?.medium?.cdnUrl || profilePicture.sizes?.medium?.url,
          large: profilePicture.sizes?.large?.cdnUrl || profilePicture.sizes?.large?.url
        },
        alt: profilePicture.alt,
        caption: profilePicture.caption,
        ownerType: profilePicture.ownerType,
        ownerId: profilePicture.ownerId,
        isActive: profilePicture.isActive,
        fileMetadata: profilePicture.fileMetadata,
        cloudStorage: profilePicture.cloudStorage,
        uploadedAt: profilePicture.createdAt,
        uploadedBy: profilePicture.uploadedBy
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get profile picture cloud error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get profile picture from cloud storage'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete profile picture from cloud storage
export const deleteProfilePictureCloud = async (req: PayloadRequest): Promise<Response> => {
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

    console.log('🗑️ Deleting profile picture from cloud storage:', profilePictureId)

    // Get the profile picture to verify ownership
    const profilePicture = await req.payload.findByID({
      collection: 'profile-pictures-cloud' as any,
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

    // Delete the profile picture (this will trigger the afterDelete hook to remove files from S3)
    await req.payload.delete({
      collection: 'profile-pictures-cloud' as any,
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
      message: 'Profile picture deleted successfully from cloud storage'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete profile picture cloud error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete profile picture from cloud storage'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// endpoints/profileManagementEndpoints.ts
import type { PayloadRequest } from 'payload'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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

// Helper function to get business ID
const getBusinessId = async (user: any, req: PayloadRequest): Promise<string | null> => {
  // For partner authentication, use the user.id directly as businessId
  if ((user as any).role === 'partner') {
    return user.id
  }
  
  // For regular Payload CMS users, look up by email
  const advertiser = await req.payload.find({
    collection: 'business-details',
    where: { companyEmail: { equals: user.email } },
    limit: 1
  })

  if (advertiser.docs.length > 0) {
    return advertiser.docs[0].id
  }

  return null
}

// Change Password (while logged in)
export const changePassword = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { currentPassword, newPassword, confirmPassword } = body

    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(JSON.stringify({
        error: 'Current password, new password, and confirm password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({
        error: 'New passwords do not match'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({
        error: 'New password must be at least 8 characters long'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔐 Changing password for user:', user?.email)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get current business details
    const business = await req.payload.findByID({
      collection: 'business-details',
      id: businessId
    })

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, business.password)
    
    if (!isValidPassword) {
      return new Response(JSON.stringify({
        error: 'Current password is incorrect'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Hash new password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Password changed successfully for: ${business.companyEmail}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Password changed successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Change password error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to change password',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get Profile Information
export const getProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('👤 Getting profile for user:', user?.email)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get business details
    const business = await req.payload.findByID({
      collection: 'business-details',
      id: businessId
    })

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: business.id,
        companyEmail: business.companyEmail,
        companyName: business.companyName,
        companyAddress: business.companyAddress,
        contact: business.contact,
        industry: business.industry,
        emailVerified: business.emailVerified,
        registrationStatus: business.registrationStatus,
        registrationDate: business.registrationDate,
        lastLogin: business.lastLogin,
        profilePicture: business.profilePicture,
        profilePictureUpdatedAt: business.profilePictureUpdatedAt,
        profilePictureId: business.profilePictureId,
        passwordChangedAt: business.passwordChangedAt,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update Profile Information
export const updateProfile = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const {
      companyName,
      companyAddress,
      contact,
      industry,
      profilePicture,
      profilePictureId
    } = body

    console.log('✏️ Updating profile for user:', user?.email)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Prepare update data
    const updateData: any = {}
    
    if (companyName !== undefined) updateData.companyName = companyName
    if (companyAddress !== undefined) updateData.companyAddress = companyAddress
    if (contact !== undefined) updateData.contact = contact
    if (industry !== undefined) updateData.industry = industry
    if (profilePicture !== undefined) {
      updateData.profilePicture = profilePicture
      updateData.profilePictureUpdatedAt = new Date().toISOString()
    }
    if (profilePictureId !== undefined) updateData.profilePictureId = profilePictureId

    // Update business details
    const updatedBusiness = await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: updateData
    })

    console.log(`✅ Profile updated successfully for: ${updatedBusiness.companyEmail}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedBusiness.id,
        companyEmail: updatedBusiness.companyEmail,
        companyName: updatedBusiness.companyName,
        companyAddress: updatedBusiness.companyAddress,
        contact: updatedBusiness.contact,
        industry: updatedBusiness.industry,
        profilePicture: updatedBusiness.profilePicture,
        profilePictureUpdatedAt: updatedBusiness.profilePictureUpdatedAt,
        profilePictureId: updatedBusiness.profilePictureId,
        updatedAt: updatedBusiness.updatedAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Update profile error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Upload Profile Picture (integrate with existing ProfilePictures collection)
export const uploadProfilePicture = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    const body = await parseRequestBody(req)
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    const { fileData, fileName, fileType } = body

    if (!fileData || !fileName || !fileType) {
      return new Response(JSON.stringify({
        error: 'File data, file name, and file type are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(fileType)) {
      return new Response(JSON.stringify({
        error: 'Only JPEG and PNG images are allowed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024 // 2MB
    const fileSize = Buffer.from(fileData, 'base64').length
    if (fileSize > maxSize) {
      return new Response(JSON.stringify({
        error: 'File size must be less than 2MB'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📸 Uploading profile picture for user:', user?.email)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create profile picture record
    const profilePicture = await req.payload.create({
      collection: 'profile-pictures' as any,
      data: {
        alt: `Profile picture for ${user?.email}`,
        caption: 'Business profile picture',
        ownerType: 'business',
        ownerId: businessId,
        isActive: true,
        uploadedBy: user?.id,
        fileSize: fileSize,
        mimeType: fileType,
        filename: fileName
      } as any
    })

    // Update business profile with new picture
    const updatedBusiness = await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: `/api/profile-pictures/${profilePicture.id}`,
        profilePictureId: profilePicture.id,
        profilePictureUpdatedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Profile picture uploaded successfully for: ${updatedBusiness.companyEmail}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePictureId: profilePicture.id,
        profilePictureUrl: `/api/profile-pictures/${profilePicture.id}`,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        uploadedAt: profilePicture.createdAt
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Upload profile picture error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to upload profile picture',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete Profile Picture
export const deleteProfilePicture = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    
    // Check advertiser access
    const accessCheck = checkAdvertiserAccess(user)
    if (accessCheck) return accessCheck

    console.log('🗑️ Deleting profile picture for user:', user?.email)

    // Get business ID
    const businessId = await getBusinessId(user, req)
    if (!businessId) {
      return new Response(JSON.stringify({
        error: 'Business profile not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get current business details
    const business = await req.payload.findByID({
      collection: 'business-details',
      id: businessId
    })

    if (!business.profilePictureId) {
      return new Response(JSON.stringify({
        error: 'No profile picture found to delete'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete profile picture record
    await req.payload.delete({
      collection: 'profile-pictures' as any,
      id: business.profilePictureId as string
    })

    // Update business profile to remove picture reference
    await req.payload.update({
      collection: 'business-details',
      id: businessId,
      data: {
        profilePicture: null,
        profilePictureId: null,
        profilePictureUpdatedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Profile picture deleted successfully for: ${business.companyEmail}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Delete profile picture error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete profile picture',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

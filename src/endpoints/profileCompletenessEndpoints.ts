import { PayloadRequest } from 'payload'

interface ProfileField {
  fieldName: string
  fieldType: 'required' | 'optional' | 'recommended'
  isCompleted: boolean
  currentValue?: any
  expectedFormat?: string
  validationMessage?: string
}

interface ProfileCompleteness {
  overallPercentage: number
  completedFields: number
  totalFields: number
  missingFields: ProfileField[]
  completedFields: ProfileField[]
  recommendations: string[]
  nextSteps: string[]
}

interface GuidedCompletionStep {
  stepNumber: number
  fieldName: string
  fieldType: string
  description: string
  isRequired: boolean
  currentValue?: any
  validationRules?: string[]
  helpText?: string
  estimatedTime?: string
}

// ===== PROFILE COMPLETENESS CALCULATION =====

/**
 * Calculate Profile Completeness Percentage
 * Driver sees their profile completion percentage
 */
export const getProfileCompleteness = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Calculating profile completeness for user:', user.id)

    // Get user data
    const userData = await req.payload.findByID({
      collection: 'users',
      id: user.id
    })

    // Get business details if available
    const businessDetails = await req.payload.find({
      collection: 'business-details',
      where: { user: { equals: user.id } },
      limit: 1
    }).catch(() => ({ docs: [] }))

    // Get bank details if available
    const bankDetails = await req.payload.find({
      collection: 'bank-details',
      where: { user: { equals: user.id } },
      limit: 1
    }).catch(() => ({ docs: [] }))

    // Define profile fields and their completion status
    const profileFields: ProfileField[] = [
      // Basic Profile Fields
      {
        fieldName: 'firstName',
        fieldType: 'required',
        isCompleted: !!(userData.firstName && userData.firstName.trim()),
        currentValue: userData.firstName,
        expectedFormat: 'Text (2-50 characters)'
      },
      {
        fieldName: 'lastName',
        fieldType: 'required',
        isCompleted: !!(userData.lastName && userData.lastName.trim()),
        currentValue: userData.lastName,
        expectedFormat: 'Text (2-50 characters)'
      },
      {
        fieldName: 'email',
        fieldType: 'required',
        isCompleted: !!(userData.email && userData.email.includes('@')),
        currentValue: userData.email,
        expectedFormat: 'Valid email address'
      },
      {
        fieldName: 'phoneNumber',
        fieldType: 'required',
        isCompleted: !!(userData.phoneNumber && userData.phoneNumber.length >= 10),
        currentValue: userData.phoneNumber,
        expectedFormat: 'Phone number (10+ digits)'
      },
      {
        fieldName: 'profilePicture',
        fieldType: 'recommended',
        isCompleted: !!(userData.profilePicture && userData.profilePicture.length > 0),
        currentValue: userData.profilePicture,
        expectedFormat: 'Image file (JPG, PNG)'
      },
      {
        fieldName: 'dateOfBirth',
        fieldType: 'required',
        isCompleted: !!(userData.dateOfBirth && userData.dateOfBirth.trim()),
        currentValue: userData.dateOfBirth,
        expectedFormat: 'Date (YYYY-MM-DD)'
      },
      {
        fieldName: 'address',
        fieldType: 'required',
        isCompleted: !!(userData.address && userData.address.trim()),
        currentValue: userData.address,
        expectedFormat: 'Full address'
      },
      {
        fieldName: 'driversLicense',
        fieldType: 'required',
        isCompleted: !!(userData.driversLicense && userData.driversLicense.trim()),
        currentValue: userData.driversLicense,
        expectedFormat: 'License number'
      },
      {
        fieldName: 'licenseExpiry',
        fieldType: 'required',
        isCompleted: !!(userData.licenseExpiry && userData.licenseExpiry.trim()),
        currentValue: userData.licenseExpiry,
        expectedFormat: 'Date (YYYY-MM-DD)'
      },
      {
        fieldName: 'vehicleDetails',
        fieldType: 'required',
        isCompleted: !!(userData.vehicleDetails && userData.vehicleDetails.trim()),
        currentValue: userData.vehicleDetails,
        expectedFormat: 'Vehicle information'
      }
    ]

    // Add business details fields if user is advertiser
    if (userData.role === 'advertiser' && businessDetails.docs.length > 0) {
      const business = businessDetails.docs[0]
      profileFields.push(
        {
          fieldName: 'companyName',
          fieldType: 'required',
          isCompleted: !!(business.companyName && business.companyName.trim()),
          currentValue: business.companyName,
          expectedFormat: 'Company name'
        },
        {
          fieldName: 'businessType',
          fieldType: 'required',
          isCompleted: !!(business.businessType && business.businessType.trim()),
          currentValue: business.businessType,
          expectedFormat: 'Business type'
        },
        {
          fieldName: 'businessRegistration',
          fieldType: 'required',
          isCompleted: !!(business.businessRegistration && business.businessRegistration.trim()),
          currentValue: business.businessRegistration,
          expectedFormat: 'Registration number'
        },
        {
          fieldName: 'businessAddress',
          fieldType: 'required',
          isCompleted: !!(business.businessAddress && business.businessAddress.trim()),
          currentValue: business.businessAddress,
          expectedFormat: 'Business address'
        }
      )
    }

    // Add bank details fields
    if (bankDetails.docs.length > 0) {
      const bank = bankDetails.docs[0]
      profileFields.push(
        {
          fieldName: 'bankName',
          fieldType: 'required',
          isCompleted: !!(bank.bankName && bank.bankName.trim()),
          currentValue: bank.bankName,
          expectedFormat: 'Bank name'
        },
        {
          fieldName: 'accountName',
          fieldType: 'required',
          isCompleted: !!(bank.accountName && bank.accountName.trim()),
          currentValue: bank.accountName,
          expectedFormat: 'Account holder name'
        },
        {
          fieldName: 'accountNumber',
          fieldType: 'required',
          isCompleted: !!(bank.accountNumber && bank.accountNumber.trim()),
          currentValue: bank.accountNumber,
          expectedFormat: 'Account number'
        },
        {
          fieldName: 'accountType',
          fieldType: 'required',
          isCompleted: !!(bank.accountType && bank.accountType.trim()),
          currentValue: bank.accountType,
          expectedFormat: 'Account type (Savings/Current)'
        }
      )
    }

    // Calculate completeness
    const totalFields = profileFields.length
    const completedFields = profileFields.filter(field => field.isCompleted)
    const completedCount = completedFields.length
    const overallPercentage = totalFields > 0 ? Math.round((completedCount / totalFields) * 100) : 0

    // Get missing fields
    const missingFields = profileFields.filter(field => !field.isCompleted)
    const requiredMissing = missingFields.filter(field => field.fieldType === 'required')
    const recommendedMissing = missingFields.filter(field => field.fieldType === 'recommended')

    // Generate recommendations
    const recommendations: string[] = []
    if (requiredMissing.length > 0) {
      recommendations.push(`Complete ${requiredMissing.length} required field(s) to improve your profile`)
    }
    if (recommendedMissing.length > 0) {
      recommendations.push(`Add ${recommendedMissing.length} recommended field(s) to enhance your profile`)
    }
    if (overallPercentage < 50) {
      recommendations.push('Your profile is incomplete. Complete more fields to increase trust and opportunities')
    } else if (overallPercentage < 80) {
      recommendations.push('Your profile is partially complete. Add more details to maximize opportunities')
    } else {
      recommendations.push('Great job! Your profile is well-completed')
    }

    // Generate next steps
    const nextSteps: string[] = []
    if (requiredMissing.length > 0) {
      nextSteps.push(`1. Complete required fields: ${requiredMissing.map(f => f.fieldName).join(', ')}`)
    }
    if (recommendedMissing.length > 0) {
      nextSteps.push(`2. Add recommended fields: ${recommendedMissing.map(f => f.fieldName).join(', ')}`)
    }
    if (nextSteps.length === 0) {
      nextSteps.push('Your profile is complete! Keep it updated.')
    }

    const completeness: ProfileCompleteness = {
      overallPercentage,
      completedFields: completedCount,
      totalFields,
      missingFields,
      completedFields,
      recommendations,
      nextSteps
    }

    console.log('✅ Profile completeness calculated:', overallPercentage + '%')

    return new Response(JSON.stringify({
      success: true,
      completeness
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get profile completeness error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to calculate profile completeness',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== MISSING FIELD DETECTION =====

/**
 * Detect Missing Fields
 * Driver sees which specific fields are missing from their profile
 */
export const getMissingFields = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔍 Detecting missing fields for user:', user.id)

    // Get user data
    const userData = await req.payload.findByID({
      collection: 'users',
      id: user.id
    })

    // Get business and bank details
    const businessDetails = await req.payload.find({
      collection: 'business-details',
      where: { user: { equals: user.id } },
      limit: 1
    }).catch(() => ({ docs: [] }))

    const bankDetails = await req.payload.find({
      collection: 'bank-details',
      where: { user: { equals: user.id } },
      limit: 1
    }).catch(() => ({ docs: [] }))

    // Define field requirements based on user role
    const fieldRequirements: ProfileField[] = []

    // Basic fields for all users
    const basicFields = [
      { name: 'firstName', type: 'required', value: userData.firstName },
      { name: 'lastName', type: 'required', value: userData.lastName },
      { name: 'email', type: 'required', value: userData.email },
      { name: 'phoneNumber', type: 'required', value: userData.phoneNumber },
      { name: 'dateOfBirth', type: 'required', value: userData.dateOfBirth },
      { name: 'address', type: 'required', value: userData.address },
      { name: 'driversLicense', type: 'required', value: userData.driversLicense },
      { name: 'licenseExpiry', type: 'required', value: userData.licenseExpiry },
      { name: 'vehicleDetails', type: 'required', value: userData.vehicleDetails },
      { name: 'profilePicture', type: 'recommended', value: userData.profilePicture }
    ]

    // Add basic fields
    basicFields.forEach(field => {
      const isCompleted = !!(field.value && field.value.toString().trim())
      fieldRequirements.push({
        fieldName: field.name,
        fieldType: field.type as 'required' | 'optional' | 'recommended',
        isCompleted,
        currentValue: field.value,
        validationMessage: !isCompleted ? `${field.name} is required` : undefined
      })
    })

    // Add business fields for advertisers
    if (userData.role === 'advertiser') {
      const business = businessDetails.docs.length > 0 ? businessDetails.docs[0] : {}
      const businessFields = [
        { name: 'companyName', type: 'required', value: business.companyName },
        { name: 'businessType', type: 'required', value: business.businessType },
        { name: 'businessRegistration', type: 'required', value: business.businessRegistration },
        { name: 'businessAddress', type: 'required', value: business.businessAddress }
      ]

      businessFields.forEach(field => {
        const isCompleted = !!(field.value && field.value.toString().trim())
        fieldRequirements.push({
          fieldName: field.name,
          fieldType: 'required',
          isCompleted,
          currentValue: field.value,
          validationMessage: !isCompleted ? `${field.name} is required for advertisers` : undefined
        })
      })
    }

    // Add bank fields
    const bank = bankDetails.docs.length > 0 ? bankDetails.docs[0] : {}
    const bankFields = [
      { name: 'bankName', type: 'required', value: bank.bankName },
      { name: 'accountName', type: 'required', value: bank.accountName },
      { name: 'accountNumber', type: 'required', value: bank.accountNumber },
      { name: 'accountType', type: 'required', value: bank.accountType }
    ]

    bankFields.forEach(field => {
      const isCompleted = !!(field.value && field.value.toString().trim())
      fieldRequirements.push({
        fieldName: field.name,
        fieldType: 'required',
        isCompleted,
        currentValue: field.value,
        validationMessage: !isCompleted ? `${field.name} is required for payouts` : undefined
      })
    })

    // Filter missing fields
    const missingFields = fieldRequirements.filter(field => !field.isCompleted)
    const requiredMissing = missingFields.filter(field => field.fieldType === 'required')
    const recommendedMissing = missingFields.filter(field => field.fieldType === 'recommended')

    // Categorize missing fields
    const categorizedMissing = {
      required: requiredMissing,
      recommended: recommendedMissing,
      all: missingFields
    }

    console.log('✅ Missing fields detected:', missingFields.length, 'total')

    return new Response(JSON.stringify({
      success: true,
      missingFields: categorizedMissing,
      summary: {
        totalMissing: missingFields.length,
        requiredMissing: requiredMissing.length,
        recommendedMissing: recommendedMissing.length,
        completionBlockers: requiredMissing.length
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get missing fields error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to detect missing fields',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== GUIDED COMPLETION WORKFLOW =====

/**
 * Get Guided Completion Steps
 * Driver gets step-by-step guidance to complete their profile
 */
export const getGuidedCompletionSteps = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📋 Generating guided completion steps for user:', user.id)

    // Get current profile completeness
    const completenessResponse = await getProfileCompleteness(req)
    const completenessData = await completenessResponse.json()
    const completeness = completenessData.completeness

    const completionSteps: GuidedCompletionStep[] = []
    let stepNumber = 1

    // Sort missing fields by priority (required first, then recommended)
    const sortedMissing = completeness.missingFields.sort((a, b) => {
      if (a.fieldType === 'required' && b.fieldType !== 'required') return -1
      if (a.fieldType !== 'required' && b.fieldType === 'required') return 1
      return 0
    })

    // Generate steps for missing fields
    sortedMissing.forEach(field => {
      const step: GuidedCompletionStep = {
        stepNumber,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        description: getFieldDescription(field.fieldName),
        isRequired: field.fieldType === 'required',
        currentValue: field.currentValue,
        validationRules: getFieldValidationRules(field.fieldName),
        helpText: getFieldHelpText(field.fieldName),
        estimatedTime: getFieldEstimatedTime(field.fieldName)
      }

      completionSteps.push(step)
      stepNumber++
    })

    // Add completion status
    const completionStatus = {
      totalSteps: completionSteps.length,
      completedSteps: completeness.completedFields,
      remainingSteps: completionSteps.length,
      nextStep: completionSteps.length > 0 ? completionSteps[0] : null,
      progressPercentage: completeness.overallPercentage
    }

    console.log('✅ Generated', completionSteps.length, 'completion steps')

    return new Response(JSON.stringify({
      success: true,
      completionSteps,
      completionStatus,
      tips: [
        'Complete required fields first to unlock full functionality',
        'Add recommended fields to increase your profile visibility',
        'Keep your information up to date for better opportunities',
        'Upload a professional profile picture to build trust'
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get guided completion steps error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate guided completion steps',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== PROGRESS INDICATOR DATA =====

/**
 * Get Progress Indicator Data
 * Driver sees visual progress indicator for profile completion
 */
export const getProgressIndicatorData = async (req: PayloadRequest): Promise<Response> => {
  try {
    const { user } = req
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Generating progress indicator data for user:', user.id)

    // Get profile completeness data
    const completenessResponse = await getProfileCompleteness(req)
    const completenessData = await completenessResponse.json()
    const completeness = completenessData.completeness

    // Generate progress segments
    const progressSegments = [
      {
        segment: 'basic-info',
        label: 'Basic Information',
        percentage: calculateSegmentPercentage(['firstName', 'lastName', 'email', 'phoneNumber'], completeness),
        isCompleted: calculateSegmentPercentage(['firstName', 'lastName', 'email', 'phoneNumber'], completeness) === 100,
        fields: ['firstName', 'lastName', 'email', 'phoneNumber']
      },
      {
        segment: 'personal-details',
        label: 'Personal Details',
        percentage: calculateSegmentPercentage(['dateOfBirth', 'address', 'profilePicture'], completeness),
        isCompleted: calculateSegmentPercentage(['dateOfBirth', 'address', 'profilePicture'], completeness) === 100,
        fields: ['dateOfBirth', 'address', 'profilePicture']
      },
      {
        segment: 'driver-info',
        label: 'Driver Information',
        percentage: calculateSegmentPercentage(['driversLicense', 'licenseExpiry', 'vehicleDetails'], completeness),
        isCompleted: calculateSegmentPercentage(['driversLicense', 'licenseExpiry', 'vehicleDetails'], completeness) === 100,
        fields: ['driversLicense', 'licenseExpiry', 'vehicleDetails']
      },
      {
        segment: 'bank-details',
        label: 'Bank Details',
        percentage: calculateSegmentPercentage(['bankName', 'accountName', 'accountNumber', 'accountType'], completeness),
        isCompleted: calculateSegmentPercentage(['bankName', 'accountName', 'accountNumber', 'accountType'], completeness) === 100,
        fields: ['bankName', 'accountName', 'accountNumber', 'accountType']
      }
    ]

    // Add business segment for advertisers
    if (user.role === 'advertiser') {
      progressSegments.push({
        segment: 'business-info',
        label: 'Business Information',
        percentage: calculateSegmentPercentage(['companyName', 'businessType', 'businessRegistration', 'businessAddress'], completeness),
        isCompleted: calculateSegmentPercentage(['companyName', 'businessType', 'businessRegistration', 'businessAddress'], completeness) === 100,
        fields: ['companyName', 'businessType', 'businessRegistration', 'businessAddress']
      })
    }

    // Calculate milestones
    const milestones = [
      {
        percentage: 25,
        label: 'Getting Started',
        description: 'Complete basic information',
        isReached: completeness.overallPercentage >= 25,
        reward: 'Basic profile visibility'
      },
      {
        percentage: 50,
        label: 'Halfway There',
        description: 'Complete personal and driver details',
        isReached: completeness.overallPercentage >= 50,
        reward: 'Enhanced profile visibility'
      },
      {
        percentage: 75,
        label: 'Almost Complete',
        description: 'Add bank details and verification',
        isReached: completeness.overallPercentage >= 75,
        reward: 'Priority in search results'
      },
      {
        percentage: 100,
        label: 'Profile Complete',
        description: 'All fields completed',
        isReached: completeness.overallPercentage === 100,
        reward: 'Maximum visibility and opportunities'
      }
    ]

    // Generate next actions
    const nextActions = []
    if (completeness.overallPercentage < 25) {
      nextActions.push('Complete basic information (name, email, phone)')
    } else if (completeness.overallPercentage < 50) {
      nextActions.push('Add personal details (date of birth, address)')
    } else if (completeness.overallPercentage < 75) {
      nextActions.push('Complete driver information and bank details')
    } else if (completeness.overallPercentage < 100) {
      nextActions.push('Add recommended fields to reach 100%')
    } else {
      nextActions.push('Keep your profile updated!')
    }

    const progressIndicator = {
      overallPercentage: completeness.overallPercentage,
      progressSegments,
      milestones,
      nextActions,
      completionStatus: {
        isComplete: completeness.overallPercentage === 100,
        isNearComplete: completeness.overallPercentage >= 75,
        needsAttention: completeness.overallPercentage < 50,
        lastUpdated: new Date().toISOString()
      },
      visualData: {
        progressBar: {
          current: completeness.overallPercentage,
          max: 100,
          color: getProgressColor(completeness.overallPercentage)
        },
        segments: progressSegments.map(segment => ({
          name: segment.segment,
          percentage: segment.percentage,
          color: segment.isCompleted ? '#10B981' : '#F59E0B'
        }))
      }
    }

    console.log('✅ Progress indicator data generated:', completeness.overallPercentage + '%')

    return new Response(JSON.stringify({
      success: true,
      progressIndicator
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Get progress indicator data error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate progress indicator data',
      details: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ===== HELPER FUNCTIONS =====

function getFieldDescription(fieldName: string): string {
  const descriptions: { [key: string]: string } = {
    firstName: 'Enter your first name',
    lastName: 'Enter your last name',
    email: 'Provide a valid email address',
    phoneNumber: 'Enter your phone number',
    dateOfBirth: 'Select your date of birth',
    address: 'Enter your full address',
    driversLicense: 'Enter your driver\'s license number',
    licenseExpiry: 'Select your license expiry date',
    vehicleDetails: 'Describe your vehicle information',
    profilePicture: 'Upload a profile picture',
    companyName: 'Enter your company name',
    businessType: 'Select your business type',
    businessRegistration: 'Enter your business registration number',
    businessAddress: 'Enter your business address',
    bankName: 'Select your bank',
    accountName: 'Enter account holder name',
    accountNumber: 'Enter your account number',
    accountType: 'Select account type'
  }
  return descriptions[fieldName] || 'Complete this field'
}

function getFieldValidationRules(fieldName: string): string[] {
  const rules: { [key: string]: string[] } = {
    firstName: ['Required', '2-50 characters'],
    lastName: ['Required', '2-50 characters'],
    email: ['Required', 'Valid email format'],
    phoneNumber: ['Required', '10+ digits'],
    dateOfBirth: ['Required', 'Valid date format'],
    address: ['Required', 'Full address'],
    driversLicense: ['Required', 'Valid license number'],
    licenseExpiry: ['Required', 'Future date'],
    vehicleDetails: ['Required', 'Vehicle information'],
    profilePicture: ['Optional', 'JPG/PNG format'],
    companyName: ['Required for advertisers', 'Company name'],
    businessType: ['Required for advertisers', 'Business type'],
    businessRegistration: ['Required for advertisers', 'Registration number'],
    businessAddress: ['Required for advertisers', 'Business address'],
    bankName: ['Required for payouts', 'Bank name'],
    accountName: ['Required for payouts', 'Account holder name'],
    accountNumber: ['Required for payouts', 'Account number'],
    accountType: ['Required for payouts', 'Savings/Current']
  }
  return rules[fieldName] || []
}

function getFieldHelpText(fieldName: string): string {
  const helpTexts: { [key: string]: string } = {
    firstName: 'This will be displayed on your profile',
    lastName: 'This will be displayed on your profile',
    email: 'We\'ll use this to contact you',
    phoneNumber: 'Used for important notifications',
    dateOfBirth: 'Required for age verification',
    address: 'Used for location-based opportunities',
    driversLicense: 'Required for driver verification',
    licenseExpiry: 'Must be a future date',
    vehicleDetails: 'Include make, model, year, and plate number',
    profilePicture: 'A professional photo increases trust',
    companyName: 'Your registered business name',
    businessType: 'Select the type of business you operate',
    businessRegistration: 'Your official business registration number',
    businessAddress: 'Your business location address',
    bankName: 'Select from the list of supported banks',
    accountName: 'Must match the name on your bank account',
    accountNumber: 'Your bank account number',
    accountType: 'Choose between Savings or Current account'
  }
  return helpTexts[fieldName] || 'Complete this field to improve your profile'
}

function getFieldEstimatedTime(fieldName: string): string {
  const times: { [key: string]: string } = {
    firstName: '1 minute',
    lastName: '1 minute',
    email: '1 minute',
    phoneNumber: '1 minute',
    dateOfBirth: '1 minute',
    address: '2 minutes',
    driversLicense: '2 minutes',
    licenseExpiry: '1 minute',
    vehicleDetails: '3 minutes',
    profilePicture: '2 minutes',
    companyName: '1 minute',
    businessType: '1 minute',
    businessRegistration: '2 minutes',
    businessAddress: '2 minutes',
    bankName: '1 minute',
    accountName: '1 minute',
    accountNumber: '2 minutes',
    accountType: '1 minute'
  }
  return times[fieldName] || '1-2 minutes'
}

function calculateSegmentPercentage(fields: string[], completeness: ProfileCompleteness): number {
  const segmentFields = completeness.missingFields.concat(completeness.completedFields)
    .filter(field => fields.includes(field.fieldName))
  
  if (segmentFields.length === 0) return 0
  
  const completedCount = segmentFields.filter(field => field.isCompleted).length
  return Math.round((completedCount / segmentFields.length) * 100)
}

function getProgressColor(percentage: number): string {
  if (percentage < 25) return '#EF4444' // Red
  if (percentage < 50) return '#F59E0B' // Yellow
  if (percentage < 75) return '#3B82F6' // Blue
  return '#10B981' // Green
}

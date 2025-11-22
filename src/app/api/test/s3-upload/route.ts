import { NextRequest, NextResponse } from 'next/server'
import { profilePictureStorage } from '@/config/cloudStorage'

/**
 * Test S3 Upload Endpoint
 * POST /api/test/s3-upload
 * Body: FormData with 'file' field
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🧪 Testing S3 upload...')
    
    // Get file from FormData
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Send file in FormData with key "file"' },
        { status: 400 }
      )
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and GIF images are allowed.' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    console.log(`📤 Uploading file: ${file.name} (${file.size} bytes) to profile-pictures bucket`)
    
    // Upload to S3
    const uploadResult = await profilePictureStorage.uploadFile(
      buffer,
      file.name,
      file.type,
      'test-uploads' // Folder in S3
    )
    
    console.log('✅ Upload successful:', uploadResult.key)
    
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully to S3',
      file: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        s3Key: uploadResult.key,
        s3Url: uploadResult.url,
        cdnUrl: uploadResult.cdnUrl,
        bucket: uploadResult.bucket,
        uploadedAt: uploadResult.lastModified
      }
    })
    
  } catch (error: any) {
    console.error('❌ S3 upload test error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload file to S3',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS method for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}


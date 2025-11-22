// src/app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params
    const filename = filePath.join('/')
    
    // Remove 'file/' prefix if present (Payload 3.x format)
    const cleanFilename = filename.replace(/^file\//, '')
    
    console.log('📁 Media request:', { filename, cleanFilename })
    
    // Priority 1: Check database for S3 URL (for new uploads)
    try {
      const payload = await getPayload({ config })
      
      let media: any = null
      
      // Try to find by ID first (if cleanFilename looks like an ObjectId)
      if (/^[0-9a-fA-F]{24}$/.test(cleanFilename)) {
        try {
          media = await payload.findByID({
            collection: 'media',
            id: cleanFilename
          })
        } catch (e) {
          // Not found by ID, continue to filename lookup
        }
      }
      
      // If not found by ID, try by filename
      if (!media) {
        const mediaResult = await payload.find({
          collection: 'media',
          where: {
            filename: { equals: cleanFilename }
          },
          limit: 1,
        })
        
        if (mediaResult.docs.length > 0) {
          media = mediaResult.docs[0]
        }
      }

      if (media) {
        // Check for S3 URL in multiple possible fields
        const s3Url = (media as any).s3Url || (media as any).url
        
        // If URL looks like an S3 URL, redirect to it
        if (s3Url && (s3Url.includes('s3') || s3Url.includes('amazonaws') || s3Url.startsWith('https://'))) {
          console.log(`✅ Redirecting to S3: ${s3Url}`)
          return NextResponse.redirect(s3Url, { status: 302 })
        }
        
        // If we have a media record but URL is local format, construct S3 URL
        // PayloadCMS S3 adapter stores files as: bucket/prefix/filename
        if ((media as any).url && (media as any).url.startsWith('/api/media')) {
          const bucket = process.env.AWS_S3_BUCKET_GENERAL_MEDIA || 'beyond-trips-general-media'
          const region = process.env.AWS_REGION || 'us-east-1'
          const prefix = (media as any).prefix || 'media'
          const filename = (media as any).filename
          
          if (filename) {
            // Construct S3 URL: https://bucket.s3.region.amazonaws.com/prefix/filename
            const constructedS3Url = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/${filename}`
            
            console.log(`✅ Constructed S3 URL: ${constructedS3Url}`)
            return NextResponse.redirect(constructedS3Url, { status: 302 })
          }
        }
        
        // If we have a media record but no S3 URL, it might be in S3 but URL not set yet
        // In this case, PayloadCMS S3 adapter should have set the url field
        if ((media as any).url && (media as any).url.startsWith('https://')) {
          console.log(`✅ Redirecting to URL: ${(media as any).url}`)
          return NextResponse.redirect((media as any).url, { status: 302 })
        }
      }
    } catch (dbError: any) {
      console.error('⚠️ Database query failed:', dbError.message)
      // Continue to filesystem fallback
    }
    
    // Priority 2: Check filesystem (fallback for old files)
    const projectRoot = process.cwd()
    const possiblePaths = [
      path.join(projectRoot, 'media', cleanFilename),
      path.join(projectRoot, 'media', 'file', cleanFilename),
      path.join(projectRoot, 'media', filename),
    ]
    
    for (const fullPath of possiblePaths) {
      if (fs.existsSync(fullPath)) {
        try {
          const fileBuffer = fs.readFileSync(fullPath)
          const stats = fs.statSync(fullPath)
          
          // Determine content type
          const ext = path.extname(cleanFilename).toLowerCase()
          const contentTypeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }
          
          const contentType = contentTypeMap[ext] || 'application/octet-stream'
          
          console.log(`✅ Serving file from filesystem: ${fullPath}`)
          
          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': stats.size.toString(),
              'Cache-Control': 'public, max-age=31536000',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          })
        } catch (readError) {
          console.error(`⚠️ Error reading ${fullPath}:`, readError)
        }
      }
    }
    
    // File not found
    console.log(`⚠️ File not found: ${cleanFilename}`)
    return NextResponse.json({ 
      error: 'File not found',
      message: 'The requested file does not exist in the database or filesystem.',
      filename: cleanFilename
    }, { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    })
    
  } catch (error) {
    console.error('❌ Error serving media file:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
}
// src/app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params
    const filename = filePath.join('/')
    
    // Construct the full file path - use project root
    const projectRoot = process.cwd()
    
    // Handle Payload 3.x file/ prefix - try both with and without it
    let fullPath = path.join(projectRoot, 'media', filename)
    
    // If file not found and path starts with 'file/', try without it
    if (!fs.existsSync(fullPath) && filename.startsWith('file/')) {
      const filenameWithoutPrefix = filename.replace('file/', '')
      fullPath = path.join(projectRoot, 'media', filenameWithoutPrefix)
    }
    
    console.log('Requested file:', filename)
    console.log('Full path:', fullPath)
    console.log('Project root:', projectRoot)
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log('File not found:', fullPath)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Read the file
    const fileBuffer = fs.readFileSync(fullPath)
    
    // Get file stats for content length
    const stats = fs.statSync(fullPath)
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
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
    
    console.log('Serving file:', filename, 'Content-Type:', contentType, 'Size:', stats.size)
    
    // Return the file
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
    
  } catch (error) {
    console.error('Error serving media file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
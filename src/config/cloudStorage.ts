// config/cloudStorage.ts
import AWS from 'aws-sdk'
import { randomUUID } from 'crypto'

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
})

// CloudFront CDN Configuration
const cloudFront = new AWS.CloudFront({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
})

export interface CloudStorageConfig {
  bucket: string
  region: string
  cdnDomain?: string
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE'
}

export interface MediaUploadResult {
  url: string
  cdnUrl?: string
  key: string
  bucket: string
  size: number
  mimeType: string
  etag: string
  lastModified: Date
}

export class CloudStorageService {
  private config: CloudStorageConfig

  constructor(config: CloudStorageConfig) {
    this.config = config
  }

  // Upload file to S3
  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder: string = 'media'
  ): Promise<MediaUploadResult> {
    const key = `${folder}/${randomUUID()}-${filename}`
    
    const params = {
      Bucket: this.config.bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
      StorageClass: this.config.storageClass,
      ACL: 'public-read' // Make publicly accessible
    }

    try {
      const result = await s3.upload(params).promise()
      
      return {
        url: result.Location,
        cdnUrl: this.config.cdnDomain ? `https://${this.config.cdnDomain}/${key}` : result.Location,
        key: result.Key,
        bucket: result.Bucket,
        size: file.length,
        mimeType,
        etag: result.ETag,
        lastModified: new Date()
      }
    } catch (error) {
      console.error('S3 upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  // Upload image with multiple sizes
  async uploadImageWithSizes(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder: string = 'media',
    sizes: Array<{name: string, width: number, height: number}> = []
  ): Promise<MediaUploadResult & { sizes: Record<string, MediaUploadResult> }> {
    const sharp = require('sharp')
    
    // Upload original
    const original = await this.uploadFile(file, filename, mimeType, folder)
    
    // Generate and upload different sizes
    const sizeResults: Record<string, MediaUploadResult> = {}
    
    for (const size of sizes) {
      try {
        const resizedBuffer = await sharp(file)
          .resize(size.width, size.height, { 
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: 85 })
          .toBuffer()

        const sizeFilename = `${size.name}-${filename.replace(/\.[^/.]+$/, '.webp')}`
        const sizeResult = await this.uploadFile(
          resizedBuffer, 
          sizeFilename, 
          'image/webp', 
          folder
        )
        
        sizeResults[size.name] = sizeResult
      } catch (error) {
        console.error(`Error creating ${size.name} size:`, error)
      }
    }

    return {
      ...original,
      sizes: sizeResults
    }
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: this.config.bucket,
      Key: key
    }

    try {
      await s3.deleteObject(params).promise()
    } catch (error) {
      console.error('S3 delete error:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }

  // Get file metadata
  async getFileMetadata(key: string): Promise<any> {
    const params = {
      Bucket: this.config.bucket,
      Key: key
    }

    try {
      const result = await s3.headObject(params).promise()
      return {
        size: result.ContentLength,
        mimeType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag
      }
    } catch (error) {
      console.error('S3 metadata error:', error)
      throw new Error(`Failed to get file metadata: ${error.message}`)
    }
  }

  // Generate signed URL for private files
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const params = {
      Bucket: this.config.bucket,
      Key: key,
      Expires: expiresIn
    }

    try {
      return await s3.getSignedUrl('getObject', params)
    } catch (error) {
      console.error('S3 signed URL error:', error)
      throw new Error(`Failed to generate signed URL: ${error.message}`)
    }
  }

  // List files in folder
  async listFiles(folder: string, maxKeys: number = 1000): Promise<any[]> {
    const params = {
      Bucket: this.config.bucket,
      Prefix: folder,
      MaxKeys: maxKeys
    }

    try {
      const result = await s3.listObjectsV2(params).promise()
      return result.Contents || []
    } catch (error) {
      console.error('S3 list error:', error)
      throw new Error(`Failed to list files: ${error.message}`)
    }
  }
}

// Storage configurations for different media types
export const storageConfigs = {
  // Profile pictures - fast access, small files
  profilePictures: {
    bucket: process.env.AWS_S3_BUCKET_PROFILE_PICTURES || 'beyond-trips-profile-pictures',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_PROFILE_PICTURES,
    storageClass: 'STANDARD' as const
  },
  
  // Campaign media - moderate access, larger files
  campaignMedia: {
    bucket: process.env.AWS_S3_BUCKET_CAMPAIGN_MEDIA || 'beyond-trips-campaign-media',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_CAMPAIGN_MEDIA,
    storageClass: 'STANDARD' as const
  },
  
  // User documents - infrequent access, long-term storage
  userDocuments: {
    bucket: process.env.AWS_S3_BUCKET_USER_DOCUMENTS || 'beyond-trips-user-documents',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_USER_DOCUMENTS,
    storageClass: 'STANDARD_IA' as const // Infrequent Access for cost savings
  },
  
  // Analytics data - archival, very infrequent access
  analyticsData: {
    bucket: process.env.AWS_S3_BUCKET_ANALYTICS || 'beyond-trips-analytics',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_ANALYTICS,
    storageClass: 'GLACIER' as const // Glacier for long-term archival
  },
  
  // QR codes - generated QR code images
  qrCodes: {
    bucket: process.env.AWS_S3_BUCKET_QR_CODES || 'beyond-trips-qr-codes',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_QR_CODES,
    storageClass: 'STANDARD' as const
  },
  
  // General media - miscellaneous uploads
  generalMedia: {
    bucket: process.env.AWS_S3_BUCKET_GENERAL_MEDIA || 'beyond-trips-general-media',
    region: process.env.AWS_REGION || 'us-east-1',
    cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN_GENERAL_MEDIA,
    storageClass: 'STANDARD' as const
  }
}

// Create storage service instances
export const profilePictureStorage = new CloudStorageService(storageConfigs.profilePictures)
export const campaignMediaStorage = new CloudStorageService(storageConfigs.campaignMedia)
export const userDocumentStorage = new CloudStorageService(storageConfigs.userDocuments)
export const analyticsStorage = new CloudStorageService(storageConfigs.analyticsData)
export const qrCodeStorage = new CloudStorageService(storageConfigs.qrCodes)
export const generalMediaStorage = new CloudStorageService(storageConfigs.generalMedia)

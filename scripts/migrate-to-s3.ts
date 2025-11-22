// scripts/migrate-to-s3.ts
// Migration script to upload existing base64 QR codes and local media files to S3

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { 
  qrCodeStorage, 
  generalMediaStorage, 
  campaignMediaStorage,
  profilePictureStorage,
  userDocumentStorage
} from '../src/config/cloudStorage'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MigrationStats {
  magazineBarcodes: { total: number; migrated: number; failed: number }
  advertiserQRCodes: { total: number; migrated: number; failed: number }
  mediaFiles: { total: number; migrated: number; failed: number }
  campaignMedia: { total: number; migrated: number; failed: number }
  profilePictures: { total: number; migrated: number; failed: number }
}

async function migrateMagazineBarcodes(payload: any, stats: MigrationStats) {
  console.log('\n📚 Migrating Magazine Barcodes...')
  
  try {
    const magazines = await payload.find({
      collection: 'driver-magazines',
      where: {
        and: [
          { barcodeImage: { exists: true } },
          { qrImageUrl: { exists: false } }
        ]
      },
      limit: 1000,
    })

    stats.magazineBarcodes.total = magazines.docs.length
    console.log(`Found ${magazines.docs.length} magazines with base64 barcodes to migrate`)

    for (const magazine of magazines.docs) {
      try {
        const barcodeImage = (magazine as any).barcodeImage
        const barcode = (magazine as any).barcode

        if (!barcodeImage || !barcode) {
          console.log(`⚠️ Skipping magazine ${magazine.id}: missing barcode or image`)
          continue
        }

        // Extract base64 data
        const base64Data = barcodeImage.includes(',') 
          ? barcodeImage.split(',')[1] 
          : barcodeImage.replace(/^data:image\/\w+;base64,/, '')
        
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Upload to S3
        const uploadResult = await qrCodeStorage.uploadFile(
          imageBuffer,
          `barcode-${barcode}.png`,
          'image/png',
          'magazine-barcodes'
        )

        // Update magazine with S3 URL
        await payload.update({
          collection: 'driver-magazines',
          id: magazine.id,
          data: {
            qrImageUrl: uploadResult.url,
          } as any,
        })

        stats.magazineBarcodes.migrated++
        console.log(`✅ Migrated magazine ${magazine.id}: ${uploadResult.url}`)
      } catch (error: any) {
        stats.magazineBarcodes.failed++
        console.error(`❌ Failed to migrate magazine ${magazine.id}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('❌ Error migrating magazine barcodes:', error.message)
  }
}

async function migrateAdvertiserQRCodes(payload: any, stats: MigrationStats) {
  console.log('\n📱 Migrating Advertiser QR Codes...')
  
  try {
    const qrCodes = await payload.find({
      collection: 'advertiser-qr-codes',
      where: {
        and: [
          { qrImageData: { exists: true } },
          { qrImageUrl: { exists: false } }
        ]
      },
      limit: 1000,
    })

    stats.advertiserQRCodes.total = qrCodes.docs.length
    console.log(`Found ${qrCodes.docs.length} advertiser QR codes with base64 to migrate`)

    for (const qrCode of qrCodes.docs) {
      try {
        const qrImageData = (qrCode as any).qrImageData
        const qrCodeId = (qrCode as any).qrCode

        if (!qrImageData || !qrCodeId) {
          console.log(`⚠️ Skipping QR code ${qrCode.id}: missing data`)
          continue
        }

        // Extract base64 data
        const base64Data = qrImageData.includes(',') 
          ? qrImageData.split(',')[1] 
          : qrImageData.replace(/^data:image\/\w+;base64,/, '')
        
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Upload to S3
        const uploadResult = await qrCodeStorage.uploadFile(
          imageBuffer,
          `qr-${qrCodeId}.png`,
          'image/png',
          'advertiser-qr-codes'
        )

        // Update QR code with S3 URL
        await payload.update({
          collection: 'advertiser-qr-codes',
          id: qrCode.id,
          data: {
            qrImageUrl: uploadResult.url,
          } as any,
        })

        stats.advertiserQRCodes.migrated++
        console.log(`✅ Migrated QR code ${qrCode.id}: ${uploadResult.url}`)
      } catch (error: any) {
        stats.advertiserQRCodes.failed++
        console.error(`❌ Failed to migrate QR code ${qrCode.id}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('❌ Error migrating advertiser QR codes:', error.message)
  }
}

async function migrateMediaFiles(payload: any, stats: MigrationStats) {
  console.log('\n📁 Migrating Media Files...')
  
  try {
    const mediaFiles = await payload.find({
      collection: 'media',
      where: {
        s3Url: { exists: false }
      },
      limit: 1000,
    })

    stats.mediaFiles.total = mediaFiles.docs.length
    console.log(`Found ${mediaFiles.docs.length} media files to migrate`)

    const mediaDir = path.resolve(__dirname, '../media')

    for (const media of mediaFiles.docs) {
      try {
        const filename = (media as any).filename
        const url = (media as any).url // Payload's generated URL
        const mimeType = (media as any).mimeType || 'application/octet-stream'

        if (!filename && !url) {
          console.log(`⚠️ Skipping media ${media.id}: no filename or URL`)
          continue
        }

        let fileBuffer: Buffer | null = null

        // Try to fetch from Payload's URL first (if it's a local URL)
        if (url && (url.startsWith('/') || url.includes('localhost') || url.includes('127.0.0.1'))) {
          try {
            // Construct full URL if relative
            const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
            
            console.log(`📥 Fetching from Payload URL: ${fullUrl}`)
            const response = await fetch(fullUrl)
            
            if (response.ok) {
              fileBuffer = Buffer.from(await response.arrayBuffer())
              console.log(`✅ Fetched file from URL: ${fullUrl} (${fileBuffer.length} bytes)`)
            } else {
              console.log(`⚠️ HTTP ${response.status} when fetching ${fullUrl}`)
            }
          } catch (fetchError: any) {
            console.log(`⚠️ Could not fetch from URL ${url}: ${fetchError.message}`)
          }
        }

        // Fallback: Try to read from filesystem
        if (!fileBuffer && filename) {
          const filePath = path.join(mediaDir, filename)

          if (fs.existsSync(filePath)) {
            fileBuffer = fs.readFileSync(filePath)
            console.log(`✅ Read file from filesystem: ${filePath}`)
          } else {
            // Try with 'file/' prefix (Payload 3.x format)
            const filePathWithPrefix = path.join(mediaDir, 'file', filename)
            if (fs.existsSync(filePathWithPrefix)) {
              fileBuffer = fs.readFileSync(filePathWithPrefix)
              console.log(`✅ Read file from filesystem (with prefix): ${filePathWithPrefix}`)
            } else {
              // Try checking sizes directory (Payload generates thumbnails)
              const sizesDir = path.join(mediaDir, filename.replace(/\.[^/.]+$/, ''))
              if (fs.existsSync(sizesDir) && fs.statSync(sizesDir).isDirectory()) {
                // Try to find original in parent
                const parentPath = path.join(mediaDir, path.basename(filename))
                if (fs.existsSync(parentPath)) {
                  fileBuffer = fs.readFileSync(parentPath)
                  console.log(`✅ Read file from sizes directory: ${parentPath}`)
                }
              }
            }
          }
        }

        if (!fileBuffer) {
          console.log(`⚠️ Skipping media ${media.id}: file not accessible (filename: ${filename}, url: ${url})`)
          stats.mediaFiles.failed++
          continue
        }

        // Upload to S3
        const uploadResult = await generalMediaStorage.uploadFile(
          fileBuffer,
          filename || `media-${media.id}`,
          mimeType,
          'media'
        )

        // Update media with S3 URL
        await payload.update({
          collection: 'media',
          id: media.id,
          data: {
            s3Url: uploadResult.url,
            s3Key: uploadResult.key,
            s3Bucket: uploadResult.bucket,
          } as any,
        })

        stats.mediaFiles.migrated++
        console.log(`✅ Migrated media ${media.id}: ${uploadResult.url}`)
      } catch (error: any) {
        stats.mediaFiles.failed++
        console.error(`❌ Failed to migrate media ${media.id}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('❌ Error migrating media files:', error.message)
  }
}

async function migrateCampaignMedia(payload: any, stats: MigrationStats) {
  console.log('\n🎬 Migrating Campaign Media...')
  
  try {
    const campaignMedia = await payload.find({
      collection: 'campaign-media',
      where: {
        s3Url: { exists: false }
      },
      limit: 1000,
    })

    stats.campaignMedia.total = campaignMedia.docs.length
    console.log(`Found ${campaignMedia.docs.length} campaign media files to migrate`)

    // Note: Campaign media might be stored as URLs, not local files
    // This migration only handles cases where we can fetch and re-upload
    for (const media of campaignMedia.docs) {
      try {
        const fileUrl = (media as any).fileUrl
        const fileName = (media as any).fileName
        const fileType = (media as any).fileType

        if (!fileUrl || !fileName) {
          console.log(`⚠️ Skipping campaign media ${media.id}: missing URL or filename`)
          continue
        }

        // Skip if it's already an S3 URL
        if (fileUrl.includes('amazonaws.com') || fileUrl.includes('s3.')) {
          console.log(`ℹ️ Campaign media ${media.id} already has S3 URL`)
          continue
        }

        // Try to fetch the file if it's a URL
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          try {
            const response = await fetch(fileUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch: ${response.statusText}`)
            }
            const fileBuffer = Buffer.from(await response.arrayBuffer())

            // Determine MIME type
            const mimeTypeMap: Record<string, string> = {
              'pdf': 'application/pdf',
              'jpeg': 'image/jpeg',
              'jpg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'mp4': 'video/mp4',
              'mov': 'video/quicktime',
              'avi': 'video/x-msvideo'
            }
            const mimeType = mimeTypeMap[fileType?.toLowerCase() || ''] || 'application/octet-stream'

            const campaignId = typeof (media as any).campaignId === 'object' 
              ? (media as any).campaignId.id 
              : (media as any).campaignId

            // Upload to S3
            const uploadResult = await campaignMediaStorage.uploadFile(
              fileBuffer,
              fileName,
              mimeType,
              `campaigns/${campaignId || 'unknown'}`
            )

            // Update campaign media with S3 URL
            await payload.update({
              collection: 'campaign-media',
              id: media.id,
              data: {
                s3Url: uploadResult.url,
                s3Key: uploadResult.key,
                s3Bucket: uploadResult.bucket,
                fileUrl: uploadResult.url, // Update fileUrl to S3 URL
              } as any,
            })

            stats.campaignMedia.migrated++
            console.log(`✅ Migrated campaign media ${media.id}: ${uploadResult.url}`)
          } catch (fetchError: any) {
            console.log(`⚠️ Could not fetch campaign media ${media.id} from ${fileUrl}: ${fetchError.message}`)
            stats.campaignMedia.failed++
          }
        } else {
          console.log(`ℹ️ Skipping campaign media ${media.id}: local file path (${fileUrl})`)
        }
      } catch (error: any) {
        stats.campaignMedia.failed++
        console.error(`❌ Failed to migrate campaign media ${media.id}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('❌ Error migrating campaign media:', error.message)
  }
}

async function migrateProfilePictures(payload: any, stats: MigrationStats) {
  console.log('\n📸 Migrating Profile Pictures...')
  
  try {
    // Check ProfilePictures collection (local storage)
    const profilePictures = await payload.find({
      collection: 'profile-pictures',
      limit: 1000,
    })

    stats.profilePictures.total = profilePictures.docs.length
    console.log(`Found ${profilePictures.docs.length} profile pictures to check`)

    const profilePicturesDir = path.resolve(__dirname, '../media/profile-pictures')

    for (const picture of profilePictures.docs) {
      try {
        const filename = (picture as any).filename

        if (!filename) {
          console.log(`⚠️ Skipping profile picture ${picture.id}: no filename`)
          continue
        }

        // Check if already has cloud storage (ProfilePicturesCloud)
        const cloudPictures = await payload.find({
          collection: 'profile-pictures-cloud',
          where: {
            ownerId: { equals: (picture as any).ownerId || '' }
          },
          limit: 1,
        })

        if (cloudPictures.docs.length > 0 && (cloudPictures.docs[0] as any).cloudStorage?.url) {
          console.log(`ℹ️ Profile picture ${picture.id} already has cloud storage`)
          continue
        }

        const url = (picture as any).url // Payload's generated URL
        const mimeType = (picture as any).mimeType || 'image/jpeg'
        
        let fileBuffer: Buffer | null = null

        // Try to fetch from Payload's URL first
        if (url && (url.startsWith('/') || url.includes('localhost') || url.includes('127.0.0.1'))) {
          try {
            const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
            
            console.log(`📥 Fetching profile picture from URL: ${fullUrl}`)
            const response = await fetch(fullUrl)
            
            if (response.ok) {
              fileBuffer = Buffer.from(await response.arrayBuffer())
              console.log(`✅ Fetched profile picture from URL: ${fullUrl} (${fileBuffer.length} bytes)`)
            }
          } catch (fetchError: any) {
            console.log(`⚠️ Could not fetch from URL ${url}: ${fetchError.message}`)
          }
        }

        // Fallback: Try to read from filesystem
        if (!fileBuffer && filename) {
          const filePath = path.join(profilePicturesDir, filename)

          if (fs.existsSync(filePath)) {
            fileBuffer = fs.readFileSync(filePath)
            console.log(`✅ Read profile picture from filesystem: ${filePath}`)
          } else {
            // Try with 'file/' prefix
            const filePathWithPrefix = path.join(profilePicturesDir, 'file', filename)
            if (fs.existsSync(filePathWithPrefix)) {
              fileBuffer = fs.readFileSync(filePathWithPrefix)
              console.log(`✅ Read profile picture from filesystem (with prefix): ${filePathWithPrefix}`)
            }
          }
        }

        if (!fileBuffer) {
          console.log(`⚠️ Skipping profile picture ${picture.id}: file not accessible (filename: ${filename}, url: ${url})`)
          stats.profilePictures.failed++
          continue
        }

        // Upload to S3 (simplified - just upload original, sizes can be generated later if needed)
        const uploadResult = await profilePictureStorage.uploadFile(
          fileBuffer,
          filename,
          mimeType,
          'profile-pictures'
        )

        // Create or update ProfilePicturesCloud record
        if (cloudPictures.docs.length > 0) {
          // Update existing cloud record
          await payload.update({
            collection: 'profile-pictures-cloud',
            id: cloudPictures.docs[0].id,
            data: {
              cloudStorage: {
                url: uploadResult.url,
                cdnUrl: uploadResult.cdnUrl,
                key: uploadResult.key,
                bucket: uploadResult.bucket,
                etag: uploadResult.etag,
                lastModified: uploadResult.lastModified,
              },
            } as any,
          })
        } else {
          // Create new cloud record
          await payload.create({
            collection: 'profile-pictures-cloud',
            data: {
              alt: (picture as any).alt || 'Profile Picture',
              caption: (picture as any).caption || '',
              ownerType: (picture as any).ownerType || 'user',
              ownerId: (picture as any).ownerId || (picture as any).uploadedBy?.id || '',
              isActive: (picture as any).isActive !== false,
              uploadedBy: (picture as any).uploadedBy?.id || null,
              cloudStorage: {
                url: uploadResult.url,
                cdnUrl: uploadResult.cdnUrl,
                key: uploadResult.key,
                bucket: uploadResult.bucket,
                etag: uploadResult.etag,
                lastModified: uploadResult.lastModified,
              },
            } as any,
          })
        }

        stats.profilePictures.migrated++
        console.log(`✅ Migrated profile picture ${picture.id}: ${uploadResult.url}`)
      } catch (error: any) {
        stats.profilePictures.failed++
        console.error(`❌ Failed to migrate profile picture ${picture.id}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('❌ Error migrating profile pictures:', error.message)
  }
}

async function main() {
  console.log('🚀 Starting S3 Migration Script...\n')
  console.log('This script will migrate:')
  console.log('  - Magazine barcodes (base64 -> S3)')
  console.log('  - Advertiser QR codes (base64 -> S3)')
  console.log('  - Media files (local -> S3)')
  console.log('  - Campaign media (URLs -> S3)')
  console.log('  - Profile pictures (local -> S3)\n')

  const stats: MigrationStats = {
    magazineBarcodes: { total: 0, migrated: 0, failed: 0 },
    advertiserQRCodes: { total: 0, migrated: 0, failed: 0 },
    mediaFiles: { total: 0, migrated: 0, failed: 0 },
    campaignMedia: { total: 0, migrated: 0, failed: 0 },
    profilePictures: { total: 0, migrated: 0, failed: 0 },
  }

  try {
    const payload = await getPayload({ config })

    // Run migrations
    await migrateMagazineBarcodes(payload, stats)
    await migrateAdvertiserQRCodes(payload, stats)
    await migrateMediaFiles(payload, stats)
    await migrateCampaignMedia(payload, stats)
    await migrateProfilePictures(payload, stats)

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Migration Summary')
    console.log('='.repeat(60))
    console.log(`Magazine Barcodes:    ${stats.magazineBarcodes.migrated}/${stats.magazineBarcodes.total} migrated, ${stats.magazineBarcodes.failed} failed`)
    console.log(`Advertiser QR Codes:  ${stats.advertiserQRCodes.migrated}/${stats.advertiserQRCodes.total} migrated, ${stats.advertiserQRCodes.failed} failed`)
    console.log(`Media Files:          ${stats.mediaFiles.migrated}/${stats.mediaFiles.total} migrated, ${stats.mediaFiles.failed} failed`)
    console.log(`Campaign Media:       ${stats.campaignMedia.migrated}/${stats.campaignMedia.total} migrated, ${stats.campaignMedia.failed} failed`)
    console.log(`Profile Pictures:     ${stats.profilePictures.migrated}/${stats.profilePictures.total} migrated, ${stats.profilePictures.failed} failed`)
    console.log('='.repeat(60))

    const totalMigrated = 
      stats.magazineBarcodes.migrated +
      stats.advertiserQRCodes.migrated +
      stats.mediaFiles.migrated +
      stats.campaignMedia.migrated +
      stats.profilePictures.migrated

    const totalFailed = 
      stats.magazineBarcodes.failed +
      stats.advertiserQRCodes.failed +
      stats.mediaFiles.failed +
      stats.campaignMedia.failed +
      stats.profilePictures.failed

    console.log(`\n✅ Total migrated: ${totalMigrated}`)
    if (totalFailed > 0) {
      console.log(`⚠️ Total failed: ${totalFailed}`)
    }
    console.log('\n🎉 Migration complete!')

  } catch (error: any) {
    console.error('❌ Migration script error:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Run migration
main()


// scripts/migrate-campaign-media.ts
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generalMediaStorage } from '../src/config/cloudStorage'

/**
 * Migration Script: Campaign Media to Media Collection
 * 
 * This script migrates existing campaign-media records to use the new
 * mediaFile relationship instead of direct file storage fields.
 * 
 * Strategy:
 * 1. Find all campaign-media records without mediaFile
 * 2. For each record:
 *    - If s3Url exists: Create Media entry pointing to existing S3 file
 *    - If only fileUrl exists: Download file and upload to S3, then create Media entry
 *    - If no file data: Skip (legacy/broken record)
 * 3. Update campaign-media record with mediaFile relationship
 * 4. Archive old fields (don't delete for rollback safety)
 * 
 * Usage:
 *   npm run migrate:campaign-media
 *   npm run migrate:campaign-media -- --dry-run
 *   npm run migrate:campaign-media -- --limit=10
 */

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

async function migrateCampaignMediaRecords(payload: any, dryRun = false, limit = 0) {
  console.log('\n🚀 Starting Campaign Media Migration')
  console.log('=====================================')
  console.log(`Dry Run: ${dryRun ? 'YES ✅' : 'NO ⚠️'}`)
  console.log(`Limit: ${limit > 0 ? limit : 'None (all records)'}`)
  console.log('')

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Find all campaign-media records without mediaFile
    console.log('📊 Fetching campaign-media records...')
    const campaignMedia = await payload.find({
      collection: 'campaign-media',
      where: {
        mediaFile: { exists: false },
      },
      limit: limit > 0 ? limit : 10000,
      depth: 0, // Don't populate relationships
    })

    stats.total = campaignMedia.docs.length
    console.log(`Found ${stats.total} records to migrate\n`)

    if (stats.total === 0) {
      console.log('✅ No records to migrate!')
      return stats
    }

    for (const record of campaignMedia.docs) {
      const recordId = record.id
      const fileName = (record as any).fileName || 'unknown'
      const fileUrl = (record as any).fileUrl || ''
      const s3Url = (record as any).s3Url || ''
      const fileSize = (record as any).fileSize || 0
      const fileType = (record as any).fileType || 'unknown'

      console.log(`\n📄 Processing: ${recordId} (${fileName})`)

      try {
        // Skip if no file data
        if (!s3Url && !fileUrl) {
          console.log('  ⚠️  No file URL found - skipping (legacy/broken record)')
          stats.skipped++
          continue
        }

        // Determine MIME type from fileType
        const mimeTypeMap: Record<string, string> = {
          pdf: 'application/pdf',
          jpeg: 'image/jpeg',
          jpg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          mp4: 'video/mp4',
          mov: 'video/quicktime',
          avi: 'video/x-msvideo',
          other: 'application/octet-stream',
        }
        const mimeType = mimeTypeMap[fileType.toLowerCase()] || 'application/octet-stream'

        let mediaId: string | null = null

        // Case 1: S3 URL exists - create Media entry pointing to it
        if (s3Url && s3Url.includes('amazonaws.com')) {
          console.log('  ✅ S3 URL found - creating Media entry')

          if (!dryRun) {
            const mediaEntry = await payload.create({
              collection: 'media',
              data: {
                filename: fileName,
                mimeType,
                filesize: fileSize,
                alt: `Campaign media - ${fileName}`,
                usageType: 'campaign_media',
                s3Url: s3Url,
                s3Key: (record as any).s3Key || extractS3Key(s3Url),
                s3Bucket: (record as any).s3Bucket || extractS3Bucket(s3Url),
              } as any,
            })

            mediaId = mediaEntry.id
            console.log(`  ✅ Media entry created: ${mediaId}`)
          } else {
            console.log('  [DRY RUN] Would create Media entry')
          }
        }
        // Case 2: Only fileUrl exists - try to fetch and re-upload
        else if (fileUrl) {
          console.log('  ⚠️  No S3 URL - attempting to fetch and re-upload')

          try {
            // Try to fetch file
            const response = await fetch(fileUrl)
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const fileBuffer = Buffer.from(await response.arrayBuffer())
            console.log(`  📥 Fetched file: ${fileBuffer.length} bytes`)

            if (!dryRun) {
              // Upload to S3
              const uploadResult = await generalMediaStorage.uploadFile(
                fileBuffer,
                fileName,
                mimeType,
                'campaign-media'
              )

              console.log(`  ☁️  Uploaded to S3: ${uploadResult.url}`)

              // Create Media entry
              const mediaEntry = await payload.create({
                collection: 'media',
                data: {
                  filename: fileName,
                  mimeType,
                  filesize: fileBuffer.length,
                  alt: `Campaign media - ${fileName}`,
                  usageType: 'campaign_media',
                  s3Url: uploadResult.url,
                  s3Key: uploadResult.key,
                  s3Bucket: uploadResult.bucket,
                } as any,
              })

              mediaId = mediaEntry.id
              console.log(`  ✅ Media entry created: ${mediaId}`)
            } else {
              console.log('  [DRY RUN] Would upload to S3 and create Media entry')
            }
          } catch (fetchError: any) {
            console.log(`  ❌ Failed to fetch file: ${fetchError.message}`)
            stats.skipped++
            continue
          }
        }

        // Update campaign-media record with mediaFile relationship
        if (mediaId) {
          if (!dryRun) {
            await payload.update({
              collection: 'campaign-media',
              id: recordId,
              data: {
                mediaFile: mediaId,
                // Keep legacy fields for rollback safety (don't delete)
              } as any,
            })

            console.log(`  ✅ Updated campaign-media record with mediaFile`)
          } else {
            console.log('  [DRY RUN] Would update campaign-media record')
          }

          stats.migrated++
        } else {
          stats.skipped++
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${recordId}:`, error.message)
        stats.failed++
        stats.errors.push({
          id: recordId,
          error: error.message,
        })
      }
    }

    // Print summary
    console.log('\n\n📊 Migration Summary')
    console.log('=====================')
    console.log(`Total records:      ${stats.total}`)
    console.log(`Migrated:           ${stats.migrated} ✅`)
    console.log(`Skipped:            ${stats.skipped} ⚠️`)
    console.log(`Failed:             ${stats.failed} ❌`)
    console.log(`Success rate:       ${stats.total > 0 ? Math.round((stats.migrated / stats.total) * 100) : 0}%`)
    console.log('')

    if (stats.errors.length > 0) {
      console.log('❌ Errors:')
      stats.errors.forEach((err) => {
        console.log(`  - ${err.id}: ${err.error}`)
      })
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made')
      console.log('Run without --dry-run to apply changes')
    }

    return stats
  } catch (error: any) {
    console.error('❌ Migration script error:', error.message)
    throw error
  }
}

// Helper: Extract S3 key from URL
function extractS3Key(s3Url: string): string {
  try {
    const url = new URL(s3Url)
    // Remove leading slash
    return url.pathname.substring(1)
  } catch {
    return ''
  }
}

// Helper: Extract S3 bucket from URL
function extractS3Bucket(s3Url: string): string {
  try {
    const url = new URL(s3Url)
    // Extract bucket from subdomain (e.g., bucket-name.s3.amazonaws.com)
    const parts = url.hostname.split('.')
    if (parts.length >= 3 && parts[1] === 's3') {
      return parts[0]
    }
    return ''
  } catch {
    return ''
  }
}

// Main execution
async function main() {
  console.log('🔧 Campaign Media Migration Script')
  console.log('====================================\n')

  // Parse command line arguments
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0

  try {
    const payload = await getPayload({ config })
    console.log('✅ Connected to Payload CMS\n')

    const stats = await migrateCampaignMediaRecords(payload, dryRun, limit)

    if (stats.failed > 0) {
      console.log('\n⚠️  Migration completed with errors')
      process.exit(1)
    } else {
      console.log('\n✅ Migration completed successfully!')
      process.exit(0)
    }
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error)
    process.exit(1)
  })
}

export { migrateCampaignMediaRecords }


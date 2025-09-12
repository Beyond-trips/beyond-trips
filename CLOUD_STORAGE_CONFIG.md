# Cloud Storage Configuration Guide
# ================================

## AWS S3 Setup Steps:

### 1. Create S3 Buckets:
```bash
# Create buckets for different media types
aws s3 mb s3://beyond-trips-profile-pictures
aws s3 mb s3://beyond-trips-campaign-media
aws s3 mb s3://beyond-trips-user-documents
aws s3 mb s3://beyond-trips-analytics
```

### 2. Configure Bucket Policies:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::beyond-trips-profile-pictures/*"
    }
  ]
}
```

### 3. Set up CloudFront Distributions:
- Create CloudFront distribution for each bucket
- Configure caching policies
- Set up custom domains (optional)

### 4. Environment Variables:
```bash
# Add to your .env file
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# S3 Buckets
AWS_S3_BUCKET_PROFILE_PICTURES=beyond-trips-profile-pictures
AWS_S3_BUCKET_CAMPAIGN_MEDIA=beyond-trips-campaign-media
AWS_S3_BUCKET_USER_DOCUMENTS=beyond-trips-user-documents
AWS_S3_BUCKET_ANALYTICS=beyond-trips-analytics

# CloudFront Domains
AWS_CLOUDFRONT_DOMAIN_PROFILE_PICTURES=d1234567890.cloudfront.net
AWS_CLOUDFRONT_DOMAIN_CAMPAIGN_MEDIA=d1234567890.cloudfront.net
AWS_CLOUDFRONT_DOMAIN_USER_DOCUMENTS=d1234567890.cloudfront.net
AWS_CLOUDFRONT_DOMAIN_ANALYTICS=d1234567890.cloudfront.net
```

## Storage Strategy by Media Type:

### Profile Pictures:
- **Storage Class**: STANDARD (fast access)
- **CDN**: Yes (global distribution)
- **Size Limit**: 2MB
- **Formats**: JPEG, PNG, GIF
- **Processing**: Thumbnail (150x150), Medium (300x300), Large (600x600)

### Campaign Media:
- **Storage Class**: STANDARD (moderate access)
- **CDN**: Yes (global distribution)
- **Size Limit**: 10MB
- **Formats**: PDF, JPEG, PNG, GIF, MP4, MOV, AVI
- **Processing**: Image resizing, video thumbnails

### User Documents:
- **Storage Class**: STANDARD_IA (infrequent access)
- **CDN**: Yes (regional distribution)
- **Size Limit**: 5MB
- **Formats**: PDF, JPEG, PNG
- **Processing**: None (original files only)

### Analytics Data:
- **Storage Class**: GLACIER (archival)
- **CDN**: No (not needed for archival)
- **Size Limit**: No limit
- **Formats**: JSON, CSV, Excel
- **Processing**: Compression, archival

## Cost Optimization:

### Storage Classes:
- **STANDARD**: $0.023 per GB/month (frequent access)
- **STANDARD_IA**: $0.0125 per GB/month (infrequent access)
- **GLACIER**: $0.004 per GB/month (archival)

### CDN Costs:
- **CloudFront**: $0.085 per GB (first 10TB)
- **Data Transfer**: $0.09 per GB (outbound)

### Estimated Monthly Costs (1000 users):
- Profile Pictures: ~$5/month
- Campaign Media: ~$15/month
- User Documents: ~$3/month
- Analytics Data: ~$1/month
- **Total**: ~$24/month

## Migration Strategy:

### Phase 1: Profile Pictures
1. Deploy cloud storage for profile pictures
2. Migrate existing profile pictures
3. Test and validate

### Phase 2: Campaign Media
1. Deploy cloud storage for campaign media
2. Migrate existing campaign media
3. Test and validate

### Phase 3: User Documents
1. Deploy cloud storage for user documents
2. Migrate existing user documents
3. Test and validate

### Phase 4: Analytics Data
1. Deploy cloud storage for analytics
2. Migrate existing analytics data
3. Test and validate

## Security Considerations:

### Access Control:
- IAM roles for different services
- Bucket policies for public/private access
- Signed URLs for private files

### Encryption:
- Server-side encryption (AES-256)
- Client-side encryption (optional)
- KMS encryption for sensitive data

### Monitoring:
- CloudTrail for API calls
- CloudWatch for metrics
- S3 access logs

## Performance Optimization:

### CDN Configuration:
- Edge locations for global access
- Caching policies for different content types
- Compression for text-based files

### Image Processing:
- WebP format for better compression
- Multiple sizes for responsive design
- Lazy loading for better performance

### Caching Strategy:
- Browser caching (1 year for images)
- CDN caching (30 days for media)
- Application caching (1 hour for metadata)

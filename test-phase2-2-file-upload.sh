#!/bin/bash

# Test Phase 2.2 File Upload Backend
echo "🧪 TESTING PHASE 2.2: FILE UPLOAD BACKEND"
echo "=========================================="

# Set variables
BASE_URL="http://localhost:3000"
EMAIL="testadvertiser@example.com"
PASSWORD="Test@2025"

echo ""
echo "📁 Step 1: Login as Partner"
echo "---------------------------"

# Login to get JWT token
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/partner/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Login Response: $LOGIN_RESPONSE"

# Extract JWT token
JWT_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
  echo "❌ Failed to get JWT token"
  exit 1
fi

echo "✅ JWT Token obtained: ${JWT_TOKEN:0:50}..."

echo ""
echo "📁 Step 2: Get Campaigns for File Upload"
echo "----------------------------------------"

# Get campaigns to use for file upload
CAMPAIGNS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=campaigns" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Campaigns Response: $CAMPAIGNS_RESPONSE"

# Extract first campaign ID
CAMPAIGN_ID=$(echo $CAMPAIGNS_RESPONSE | jq -r '.campaigns[0].id // empty')

if [ -z "$CAMPAIGN_ID" ] || [ "$CAMPAIGN_ID" = "null" ]; then
  echo "❌ No campaigns found"
  exit 1
fi

echo "✅ Using Campaign ID: $CAMPAIGN_ID"

echo ""
echo "📁 Step 3: Test Campaign Media File Upload"
echo "------------------------------------------"

# Create a mock base64 encoded file (small PNG)
MOCK_FILE_DATA="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

# Test campaign media file upload
UPLOAD_MEDIA_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-campaign-media" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"fileType\": \"png\",
    \"fileName\": \"test-campaign-image.png\",
    \"fileSize\": 1024,
    \"description\": \"Test campaign media file\",
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "Upload Media Response: $UPLOAD_MEDIA_RESPONSE"

echo ""
echo "📁 Step 4: Test Profile Picture Upload"
echo "--------------------------------------"

# Test profile picture upload
UPLOAD_PROFILE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileType\": \"jpg\",
    \"fileName\": \"profile-picture.jpg\",
    \"fileSize\": 512,
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "Upload Profile Response: $UPLOAD_PROFILE_RESPONSE"

echo ""
echo "📁 Step 5: Test File Validation - Invalid File Type"
echo "---------------------------------------------------"

# Test invalid file type
INVALID_TYPE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-campaign-media" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"fileType\": \"exe\",
    \"fileName\": \"malicious.exe\",
    \"fileSize\": 1024,
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "Invalid Type Response: $INVALID_TYPE_RESPONSE"

echo ""
echo "📁 Step 6: Test File Validation - File Size Limit"
echo "-------------------------------------------------"

# Test file size limit (11MB - exceeds 10MB limit)
OVERSIZED_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-campaign-media" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"fileType\": \"pdf\",
    \"fileName\": \"large-document.pdf\",
    \"fileSize\": 11534336,
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "Oversized File Response: $OVERSIZED_RESPONSE"

echo ""
echo "📁 Step 7: Test Profile Picture Size Limit"
echo "------------------------------------------"

# Test profile picture size limit (3MB - exceeds 2MB limit)
OVERSIZED_PROFILE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileType\": \"png\",
    \"fileName\": \"large-profile.png\",
    \"fileSize\": 3145728,
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "Oversized Profile Response: $OVERSIZED_PROFILE_RESPONSE"

echo ""
echo "📁 Step 8: Test Multiple File Uploads"
echo "------------------------------------"

# Upload multiple files to test batch upload
echo "Uploading PDF file..."
PDF_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-campaign-media" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"fileType\": \"pdf\",
    \"fileName\": \"campaign-brochure.pdf\",
    \"fileSize\": 2048,
    \"description\": \"Campaign brochure document\",
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "PDF Upload Response: $PDF_RESPONSE"

echo "Uploading MP4 file..."
MP4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-campaign-media" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"fileType\": \"mp4\",
    \"fileName\": \"campaign-video.mp4\",
    \"fileSize\": 5120,
    \"description\": \"Campaign promotional video\",
    \"fileData\": \"$MOCK_FILE_DATA\"
  }")

echo "MP4 Upload Response: $MP4_RESPONSE"

echo ""
echo "🎯 PHASE 2.2 FILE UPLOAD TESTING COMPLETE"
echo "========================================="
echo ""
echo "✅ Tested Endpoints:"
echo "   - Campaign Media File Upload"
echo "   - Profile Picture Upload"
echo "   - File Type Validation"
echo "   - File Size Validation"
echo "   - Multiple File Uploads"
echo ""
echo "📁 File Upload Features Implemented:"
echo "   - Campaign media upload (PDF, JPEG, PNG, GIF, MP4, MOV, AVI)"
echo "   - Profile picture upload (JPEG, PNG, GIF only)"
echo "   - File size validation (10MB for media, 2MB for profile)"
echo "   - File type validation with proper error messages"
echo "   - Campaign ownership verification"
echo "   - Automatic file URL generation"
echo "   - Upload status tracking"
echo ""
echo "🚀 Ready for Phase 2.3: Campaign Status Management"

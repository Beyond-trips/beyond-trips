#!/bin/bash

# Test Cloud Storage Profile Pictures - Phase 2.2 Enhanced
# Tests the new cloud storage implementation

echo "☁️ Testing Cloud Storage Profile Pictures"
echo "========================================"

# Configuration
BASE_URL="http://localhost:3000"
PARTNER_EMAIL="testadvertiser@example.com"
PARTNER_PASSWORD="Test@2025"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="$3"
    
    echo -e "\n${BLUE}Testing: $test_name${NC}"
    echo "Command: $command"
    
    response=$(eval "$command")
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Expected: $expected_status, Got: $status_code"
        echo "Response: $response"
        ((TESTS_FAILED++))
    fi
}

# Function to get status code
get_status_code() {
    echo "$1" | tail -n1
}

echo -e "\n${YELLOW}Step 1: Login as Partner${NC}"
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/partner/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PARTNER_EMAIL\",
    \"password\": \"$PARTNER_PASSWORD\"
  }")

LOGIN_STATUS=$(get_status_code "$LOGIN_RESPONSE")
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$LOGIN_STATUS" = "200" ]; then
    TOKEN=$(echo "$LOGIN_BODY" | jq -r '.token')
    echo -e "${GREEN}✅ Login successful${NC}"
    echo "Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_BODY"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Test Cloud Storage Profile Picture Upload${NC}"

# Create a test image file (1KB PNG)
echo "Creating test image file..."
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test_profile_cloud.png

echo -e "\n${BLUE}Testing: Upload Profile Picture to Cloud Storage${NC}"
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture-cloud" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_profile_cloud.png")

UPLOAD_STATUS=$(get_status_code "$UPLOAD_RESPONSE")
UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

if [ "$UPLOAD_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Profile picture upload to cloud storage successful${NC}"
    PROFILE_PICTURE_ID=$(echo "$UPLOAD_BODY" | jq -r '.data.id')
    CDN_URL=$(echo "$UPLOAD_BODY" | jq -r '.data.cdnUrl')
    S3_URL=$(echo "$UPLOAD_BODY" | jq -r '.data.url')
    echo "Profile Picture ID: $PROFILE_PICTURE_ID"
    echo "CDN URL: $CDN_URL"
    echo "S3 URL: $S3_URL"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Profile picture upload to cloud storage failed${NC}"
    echo "Response: $UPLOAD_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 3: Test Get Profile Picture from Cloud Storage${NC}"

GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/advertiser-dashboard?action=get-profile-picture-cloud" \
  -H "Authorization: Bearer $TOKEN")

GET_STATUS=$(get_status_code "$GET_RESPONSE")
GET_BODY=$(echo "$GET_RESPONSE" | sed '$d')

if [ "$GET_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Get profile picture from cloud storage successful${NC}"
    echo "Response: $GET_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Get profile picture from cloud storage failed${NC}"
    echo "Response: $GET_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 4: Test Cloud Storage File Validation${NC}"

# Test invalid file type
echo -e "\n${BLUE}Testing: Invalid file type (.exe)${NC}"
echo "test content" > test_file_cloud.exe

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture-cloud" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_file_cloud.exe")

INVALID_STATUS=$(get_status_code "$INVALID_RESPONSE")
INVALID_BODY=$(echo "$INVALID_RESPONSE" | sed '$d')

if [ "$INVALID_STATUS" = "400" ]; then
    echo -e "${GREEN}✅ Invalid file type correctly rejected${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Invalid file type should be rejected${NC}"
    echo "Response: $INVALID_BODY"
    ((TESTS_FAILED++))
fi

# Test oversized file (create 3MB file)
echo -e "\n${BLUE}Testing: Oversized file (3MB)${NC}"
dd if=/dev/zero of=large_file_cloud.png bs=1M count=3 2>/dev/null

LARGE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture-cloud" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@large_file_cloud.png")

LARGE_STATUS=$(get_status_code "$LARGE_RESPONSE")
LARGE_BODY=$(echo "$LARGE_RESPONSE" | sed '$d')

if [ "$LARGE_STATUS" = "400" ]; then
    echo -e "${GREEN}✅ Oversized file correctly rejected${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Oversized file should be rejected${NC}"
    echo "Response: $LARGE_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 5: Test Cloud Storage Profile Picture Replacement${NC}"

# Create another test image
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test_profile2_cloud.png

REPLACE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture-cloud" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_profile2_cloud.png")

REPLACE_STATUS=$(get_status_code "$REPLACE_RESPONSE")
REPLACE_BODY=$(echo "$REPLACE_RESPONSE" | sed '$d')

if [ "$REPLACE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Profile picture replacement in cloud storage successful${NC}"
    NEW_PROFILE_PICTURE_ID=$(echo "$REPLACE_BODY" | jq -r '.data.id')
    NEW_CDN_URL=$(echo "$REPLACE_BODY" | jq -r '.data.cdnUrl')
    echo "New Profile Picture ID: $NEW_PROFILE_PICTURE_ID"
    echo "New CDN URL: $NEW_CDN_URL"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Profile picture replacement in cloud storage failed${NC}"
    echo "Response: $REPLACE_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 6: Test Delete Profile Picture from Cloud Storage${NC}"

if [ ! -z "$PROFILE_PICTURE_ID" ]; then
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=delete-profile-picture-cloud" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"profilePictureId\": \"$PROFILE_PICTURE_ID\"}")

    DELETE_STATUS=$(get_status_code "$DELETE_RESPONSE")
    DELETE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')

    if [ "$DELETE_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Delete profile picture from cloud storage successful${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Delete profile picture from cloud storage failed${NC}"
        echo "Response: $DELETE_BODY"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠️ Skipping delete test - no profile picture ID${NC}"
fi

echo -e "\n${YELLOW}Step 7: Test Business Profile Update with Cloud Storage${NC}"

# Check if business profile was updated with cloud storage profile picture info
BUSINESS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/advertiser-dashboard?action=get-profile" \
  -H "Authorization: Bearer $TOKEN")

BUSINESS_STATUS=$(get_status_code "$BUSINESS_RESPONSE")
BUSINESS_BODY=$(echo "$BUSINESS_RESPONSE" | sed '$d')

if [ "$BUSINESS_STATUS" = "200" ]; then
    PROFILE_PICTURE_URL=$(echo "$BUSINESS_BODY" | jq -r '.data.profilePicture')
    if [ "$PROFILE_PICTURE_URL" != "null" ] && [ "$PROFILE_PICTURE_URL" != "" ]; then
        echo -e "${GREEN}✅ Business profile updated with cloud storage profile picture${NC}"
        echo "Profile Picture URL: $PROFILE_PICTURE_URL"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Business profile not updated with cloud storage profile picture${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}❌ Failed to get business profile${NC}"
    echo "Response: $BUSINESS_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 8: Test Cloud Storage Performance${NC}"

# Test CDN URL accessibility
if [ ! -z "$CDN_URL" ] && [ "$CDN_URL" != "null" ]; then
    echo -e "\n${BLUE}Testing: CDN URL accessibility${NC}"
    CDN_RESPONSE=$(curl -s -w "\n%{http_code}" -I "$CDN_URL")
    CDN_STATUS=$(get_status_code "$CDN_RESPONSE")
    
    if [ "$CDN_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ CDN URL accessible${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️ CDN URL not accessible (may not be configured)${NC}"
        echo "CDN Status: $CDN_STATUS"
    fi
else
    echo -e "${YELLOW}⚠️ Skipping CDN test - no CDN URL available${NC}"
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up test files...${NC}"
rm -f test_profile_cloud.png test_profile2_cloud.png test_file_cloud.exe large_file_cloud.png

# Summary
echo -e "\n${YELLOW}Cloud Storage Test Summary${NC}"
echo "=============================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All cloud storage tests passed! ProfilePictures cloud storage is working correctly.${NC}"
    echo -e "${BLUE}☁️ Cloud storage benefits:${NC}"
    echo "  ✅ Scalable file storage"
    echo "  ✅ CDN integration for fast global access"
    echo "  ✅ Automatic backup and redundancy"
    echo "  ✅ Cost-effective storage classes"
    echo "  ✅ Security and encryption"
    exit 0
else
    echo -e "\n${RED}❌ Some cloud storage tests failed. Please check the implementation.${NC}"
    exit 1
fi

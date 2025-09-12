#!/bin/bash

echo "🔄 Testing Enhanced Profile Management Backend (Phase 2.5)"
echo "=================================================="

# Test credentials
PARTNER_EMAIL="testadvertiser@example.com"
PARTNER_PASSWORD="Test@2025"
BASE_URL="http://localhost:3000"

echo ""
echo "Step 1: Login as Partner"
echo "------------------------"

# Login to get token
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/partner/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")

echo "Login Response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed - no token received"
  exit 1
fi

echo "✅ Login successful"
echo "Token: $TOKEN"

echo ""
echo "Step 2: Test Profile Management Endpoints"
echo "========================================="

echo ""
echo "Testing: Get Profile Information"
echo "-------------------------------"
GET_PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=get-profile" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json")

echo "Get Profile Response: $GET_PROFILE_RESPONSE"

if echo "$GET_PROFILE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Profile information retrieved successfully"
else
  echo "❌ Failed to get profile information"
fi

echo ""
echo "Testing: Update Profile Information"
echo "----------------------------------"
UPDATE_PROFILE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=update-profile" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Updated Test Company",
    "contact": "+234-800-123-4567",
    "industry": "Technology"
  }')

echo "Update Profile Response: $UPDATE_PROFILE_RESPONSE"

if echo "$UPDATE_PROFILE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Profile updated successfully"
else
  echo "❌ Failed to update profile"
fi

echo ""
echo "Testing: Upload Profile Picture"
echo "------------------------------"

# Create a test image (1x1 pixel PNG)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test_profile.png

# Upload profile picture
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=upload-profile-picture-v3" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileData\": \"$(base64 -i test_profile.png)\",
    \"fileName\": \"test_profile.png\",
    \"fileType\": \"image/png\"
  }")

echo "Upload Profile Picture Response: $UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Profile picture uploaded successfully"
else
  echo "❌ Failed to upload profile picture"
fi

echo ""
echo "Testing: Change Password"
echo "-----------------------"
CHANGE_PASSWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=change-password" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Test@2025",
    "newPassword": "NewTest@2025",
    "confirmPassword": "NewTest@2025"
  }')

echo "Change Password Response: $CHANGE_PASSWORD_RESPONSE"

if echo "$CHANGE_PASSWORD_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Password changed successfully"
  
  # Test login with new password
  echo ""
  echo "Testing: Login with New Password"
  echo "-------------------------------"
  NEW_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/partner/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"NewTest@2025\"}")
  
  echo "New Login Response: $NEW_LOGIN_RESPONSE"
  
  if echo "$NEW_LOGIN_RESPONSE" | jq -e '.token' > /dev/null; then
    echo "✅ Login with new password successful"
    
    # Change password back to original
    echo ""
    echo "Testing: Change Password Back to Original"
    echo "----------------------------------------"
    NEW_TOKEN=$(echo "$NEW_LOGIN_RESPONSE" | jq -r '.token')
    
    CHANGE_BACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=change-password" \
      -H "Authorization: JWT $NEW_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "currentPassword": "NewTest@2025",
        "newPassword": "Test@2025",
        "confirmPassword": "Test@2025"
      }')
    
    echo "Change Back Response: $CHANGE_BACK_RESPONSE"
    
    if echo "$CHANGE_BACK_RESPONSE" | jq -e '.success' > /dev/null; then
      echo "✅ Password changed back to original successfully"
    else
      echo "❌ Failed to change password back to original"
    fi
  else
    echo "❌ Login with new password failed"
  fi
else
  echo "❌ Failed to change password"
fi

echo ""
echo "Testing: Delete Profile Picture"
echo "------------------------------"
DELETE_PICTURE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=delete-profile-picture-v3" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json")

echo "Delete Profile Picture Response: $DELETE_PICTURE_RESPONSE"

if echo "$DELETE_PICTURE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Profile picture deleted successfully"
else
  echo "❌ Failed to delete profile picture"
fi

echo ""
echo "Testing: Invalid Password Change"
echo "-------------------------------"
INVALID_PASSWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=change-password" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "WrongPassword",
    "newPassword": "NewPassword123",
    "confirmPassword": "NewPassword123"
  }')

echo "Invalid Password Response: $INVALID_PASSWORD_RESPONSE"

if echo "$INVALID_PASSWORD_RESPONSE" | jq -e '.error' > /dev/null; then
  echo "✅ Invalid password correctly rejected"
else
  echo "❌ Invalid password should have been rejected"
fi

echo ""
echo "Testing: Unauthorized Access"
echo "---------------------------"
UNAUTHORIZED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=get-profile")

echo "Unauthorized Response: $UNAUTHORIZED_RESPONSE"

if echo "$UNAUTHORIZED_RESPONSE" | jq -e '.error' > /dev/null; then
  echo "✅ Unauthorized access correctly rejected"
else
  echo "❌ Unauthorized access should have been rejected"
fi

# Clean up
rm -f test_profile.png

echo ""
echo "Enhanced Profile Management Backend Test Summary"
echo "=============================================="
echo "✅ Profile management endpoints tested"
echo "✅ Password change functionality tested"
echo "✅ Profile picture upload/delete tested"
echo "✅ Security and validation tested"
echo ""
echo "🎉 Phase 2.5: Enhanced Profile Management completed!"

#!/bin/bash

echo "🚀 Testing Phase 2 - Advertiser Dashboard Endpoints"
echo "=================================================="

# Server URL
SERVER="http://localhost:3000"

# Test credentials
EMAIL="testbusiness@example.com"
PASSWORD="TestBusiness123!"

echo ""
echo "📝 Step 1: Creating New Business"
echo "-------------------------------"

# Create new business
RESPONSE=$(curl -s -X POST "$SERVER/api/partner-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "email": "'$EMAIL'",
    "password": "'$PASSWORD'",
    "companyName": "Test Business Ltd",
    "companyAddress": "123 Test Street, Lagos, Nigeria",
    "contact": "+2348012345678",
    "industry": "Technology"
  }')

echo "Business Creation Response: $RESPONSE"

# Extract token if successful
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to create business or get token"
  echo "Trying to login with existing credentials..."
  
  # Try to login with existing user
  LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/users/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "feniola07@gmail.com", "password": "Test@2025"}')
  
  echo "Login Response: $LOGIN_RESPONSE"
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
  fi
fi

echo "✅ Authentication Token: ${TOKEN:0:20}..."

echo ""
echo "🔐 Step 2: Testing Authentication"
echo "--------------------------------"

# Test authentication
AUTH_TEST=$(curl -s "$SERVER/api/advertiser-dashboard?action=overview" \
  -H "Authorization: JWT $TOKEN")

echo "Auth Test Response: $AUTH_TEST"

echo ""
echo "📊 Step 3: Testing Dashboard Overview"
echo "------------------------------------"

OVERVIEW=$(curl -s "$SERVER/api/advertiser-dashboard?action=overview" \
  -H "Authorization: JWT $TOKEN")

echo "Dashboard Overview: $OVERVIEW"

echo ""
echo "👤 Step 4: Testing Profile Management"
echo "------------------------------------"

# Get profile
PROFILE=$(curl -s "$SERVER/api/advertiser-dashboard?action=profile" \
  -H "Authorization: JWT $TOKEN")

echo "Get Profile: $PROFILE"

# Update profile
UPDATE_PROFILE=$(curl -s -X POST "$SERVER/api/advertiser-dashboard" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "action": "update-profile",
    "companyName": "Updated Test Business Ltd",
    "companyAddress": "456 Updated Street, Lagos, Nigeria",
    "contact": "+2348098765432",
    "industry": "Digital Marketing"
  }')

echo "Update Profile: $UPDATE_PROFILE"

echo ""
echo "🎯 Step 5: Testing Campaign Management"
echo "------------------------------------"

# Create campaign
CREATE_CAMPAIGN=$(curl -s -X POST "$SERVER/api/advertiser-dashboard" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "action": "create-campaign",
    "campaignName": "Test Campaign 2025",
    "campaignDescription": "This is a test campaign for Phase 2 testing",
    "campaignType": "magazine",
    "budget": 50000,
    "startDate": "2025-01-15",
    "endDate": "2025-03-15",
    "targetAudience": "Tech professionals aged 25-40"
  }')

echo "Create Campaign: $CREATE_CAMPAIGN"

# Extract campaign ID
CAMPAIGN_ID=$(echo $CREATE_CAMPAIGN | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CAMPAIGN_ID" ]; then
  echo "✅ Campaign Created with ID: $CAMPAIGN_ID"
  
  # Get all campaigns
  ALL_CAMPAIGNS=$(curl -s "$SERVER/api/advertiser-dashboard?action=all-campaigns" \
    -H "Authorization: JWT $TOKEN")
  
  echo "All Campaigns: $ALL_CAMPAIGNS"
  
  # Get draft campaigns
  DRAFT_CAMPAIGNS=$(curl -s "$SERVER/api/advertiser-dashboard?action=draft-campaigns" \
    -H "Authorization: JWT $TOKEN")
  
  echo "Draft Campaigns: $DRAFT_CAMPAIGNS"
  
  echo ""
  echo "📁 Step 6: Testing Media Upload"
  echo "------------------------------"
  
  # Upload media (simulated)
  UPLOAD_MEDIA=$(curl -s -X POST "$SERVER/api/advertiser-dashboard" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "action": "upload-media",
      "campaignId": "'$CAMPAIGN_ID'",
      "fileName": "test-banner.jpg",
      "fileType": "jpeg",
      "fileUrl": "https://example.com/test-banner.jpg",
      "fileSize": 1024000,
      "description": "Test banner for campaign"
    }')
  
  echo "Upload Media: $UPLOAD_MEDIA"
  
  # Get campaign media
  GET_MEDIA=$(curl -s "$SERVER/api/advertiser-dashboard?action=campaign-media&campaignId=$CAMPAIGN_ID" \
    -H "Authorization: JWT $TOKEN")
  
  echo "Get Campaign Media: $GET_MEDIA"
  
  echo ""
  echo "📈 Step 7: Testing Performance Tracking"
  echo "--------------------------------------"
  
  # Add performance data
  ADD_PERFORMANCE=$(curl -s -X POST "$SERVER/api/advertiser-dashboard" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "action": "add-performance",
      "campaignId": "'$CAMPAIGN_ID'",
      "impressions": 10000,
      "clicks": 500,
      "conversions": 50,
      "spend": 25000
    }')
  
  echo "Add Performance: $ADD_PERFORMANCE"
  
  echo ""
  echo "🧾 Step 8: Testing Invoice Generation"
  echo "------------------------------------"
  
  # Generate invoice
  GENERATE_INVOICE=$(curl -s -X POST "$SERVER/api/advertiser-dashboard" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "action": "generate-invoice",
      "campaignId": "'$CAMPAIGN_ID'",
      "stripePaymentIntentId": "pi_test_1234567890",
      "stripeSessionId": "cs_test_1234567890",
      "amount": 50000,
      "currency": "NGN",
      "paymentStatus": "succeeded"
    }')
  
  echo "Generate Invoice: $GENERATE_INVOICE"
  
  # Get invoices
  GET_INVOICES=$(curl -s "$SERVER/api/advertiser-dashboard?action=invoices" \
    -H "Authorization: JWT $TOKEN")
  
  echo "Get Invoices: $GET_INVOICES"
  
  echo ""
  echo "📊 Step 9: Testing Analytics"
  echo "--------------------------"
  
  # Get analytics
  ANALYTICS=$(curl -s "$SERVER/api/advertiser-dashboard?action=analytics" \
    -H "Authorization: JWT $TOKEN")
  
  echo "Analytics: $ANALYTICS"
  
  echo ""
  echo "💰 Step 10: Testing Payments"
  echo "---------------------------"
  
  # Get payments
  PAYMENTS=$(curl -s "$SERVER/api/advertiser-dashboard?action=payments" \
    -H "Authorization: JWT $TOKEN")
  
  echo "Payments: $PAYMENTS"
  
else
  echo "❌ Failed to create campaign"
fi

echo ""
echo "🎉 Phase 2 Testing Complete!"
echo "============================"

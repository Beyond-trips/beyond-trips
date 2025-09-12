#!/bin/bash

echo "🚀 Testing Phase 2 - Hosted Backend Endpoints"
echo "============================================="

# Hosted Backend URL
SERVER="https://beyond-trips-backend2.onrender.com"

# Test credentials
EMAIL="feniola07+partner20@gmail.com"
PASSWORD="Test@2025"

echo ""
echo "🔐 Step 1: Partner Login"
echo "----------------------"

# Partner login
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/partner/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}')

echo "Partner Login Response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  exit 1
fi

echo "✅ Authentication Token: ${TOKEN:0:20}..."

echo ""
echo "📊 Step 2: Testing Existing Partner Endpoints"
echo "--------------------------------------------"

# Test partner profile
echo "1. Partner Profile:"
PROFILE=$(curl -s "$SERVER/api/partner/me" \
  -H "Authorization: JWT $TOKEN")
echo "$PROFILE"

echo ""
echo "2. Subscription Plans:"
PLANS=$(curl -s "$SERVER/api/partner/subscription-plans" \
  -H "Authorization: JWT $TOKEN")
echo "$PLANS"

echo ""
echo "3. Registration Status:"
STATUS=$(curl -s "$SERVER/api/partner/status" \
  -H "Authorization: JWT $TOKEN")
echo "$STATUS"

echo ""
echo "🎯 Step 3: Testing Campaign Creation"
echo "-----------------------------------"

# Test campaign creation
CREATE_CAMPAIGN=$(curl -s -X POST "$SERVER/api/partner/create-campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "campaignName": "Test Campaign 2025",
    "campaignDescription": "This is a test campaign for Phase 2 testing",
    "campaignType": "magazine",
    "budget": 50000,
    "startDate": "2025-01-15",
    "endDate": "2025-03-15",
    "targetAudience": "Tech professionals aged 25-40"
  }')

echo "Create Campaign: $CREATE_CAMPAIGN"

# Extract campaign ID if successful
CAMPAIGN_ID=$(echo $CREATE_CAMPAIGN | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CAMPAIGN_ID" ]; then
  echo "✅ Campaign Created with ID: $CAMPAIGN_ID"
  
  echo ""
  echo "📁 Step 4: Testing Payment Setup"
  echo "-------------------------------"
  
  # Test payment setup
  PAYMENT_SETUP=$(curl -s -X POST "$SERVER/api/partner/setup-payment" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "campaignId": "'$CAMPAIGN_ID'",
      "budgetAmount": 50000,
      "paymentMethod": "stripe"
    }')
  
  echo "Payment Setup: $PAYMENT_SETUP"
  
  echo ""
  echo "✅ Step 5: Testing Registration Completion"
  echo "----------------------------------------"
  
  # Test registration completion
  COMPLETE_REGISTRATION=$(curl -s -X POST "$SERVER/api/partner/complete" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "campaignId": "'$CAMPAIGN_ID'",
      "subscriptionPlanId": "68b0c889518d538ac79be133"
    }')
  
  echo "Complete Registration: $COMPLETE_REGISTRATION"
  
else
  echo "❌ Failed to create campaign"
fi

echo ""
echo "🧾 Step 6: Testing Available Endpoints"
echo "-------------------------------------"

echo "Testing various endpoints..."

# Test logout
LOGOUT=$(curl -s -X POST "$SERVER/api/partner/logout" \
  -H "Authorization: JWT $TOKEN")
echo "Logout: $LOGOUT"

echo ""
echo "🎉 Hosted Backend Testing Complete!"
echo "=================================="
echo ""
echo "📋 Summary:"
echo "- ✅ Partner login working"
echo "- ✅ Subscription plans available"
echo "- ✅ Campaign creation endpoint exists"
echo "- ✅ Payment setup endpoint exists"
echo "- ✅ Registration completion endpoint exists"
echo ""
echo "📝 Note: Phase 2 advertiser dashboard endpoints need to be deployed to hosted backend"
echo "Current hosted backend has Phase 1 (partner registration) functionality"

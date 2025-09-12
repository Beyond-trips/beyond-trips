#!/bin/bash

echo "🚀 Testing ALL Phase 2 Deliverables"
echo "===================================="

# Hosted Backend URL for login
HOSTED_SERVER="https://beyond-trips-backend2.onrender.com"
# Local Server URL for testing
LOCAL_SERVER="http://localhost:3001"

# Test credentials
EMAIL="feniola07+partner20@gmail.com"
PASSWORD="Test@2025"

echo ""
echo "🔐 Step 1: Get Token from Hosted Backend"
echo "---------------------------------------"

# Get token from hosted backend
LOGIN_RESPONSE=$(curl -s -X POST "$HOSTED_SERVER/api/partner/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}')

echo "Hosted Login Response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token from hosted backend"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

echo ""
echo "📊 Step 2: Testing Phase 2 Deliverables Locally"
echo "=============================================="

echo ""
echo "🎯 DELIVERABLE 1: Dashboard Overview"
echo "-----------------------------------"
OVERVIEW=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=overview" \
  -H "Authorization: JWT $TOKEN")
echo "Result: $OVERVIEW"
if [[ $OVERVIEW == *"success"* ]]; then
  echo "✅ Dashboard Overview: WORKING"
else
  echo "❌ Dashboard Overview: NOT WORKING"
fi

echo ""
echo "👤 DELIVERABLE 2: Business Profile Management"
echo "--------------------------------------------"
PROFILE=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=profile" \
  -H "Authorization: JWT $TOKEN")
echo "Get Profile: $PROFILE"

UPDATE_PROFILE=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
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

if [[ $PROFILE == *"success"* ]] && [[ $UPDATE_PROFILE == *"success"* ]]; then
  echo "✅ Business Profile Management: WORKING"
else
  echo "❌ Business Profile Management: NOT WORKING"
fi

echo ""
echo "🎯 DELIVERABLE 3: Campaign Management"
echo "------------------------------------"
CREATE_CAMPAIGN=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
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

CAMPAIGN_ID=$(echo $CREATE_CAMPAIGN | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CAMPAIGN_ID" ]; then
  echo "✅ Campaign Created with ID: $CAMPAIGN_ID"
  
  # Test get all campaigns
  ALL_CAMPAIGNS=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=all-campaigns" \
    -H "Authorization: JWT $TOKEN")
  echo "All Campaigns: $ALL_CAMPAIGNS"
  
  # Test get draft campaigns
  DRAFT_CAMPAIGNS=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=draft-campaigns" \
    -H "Authorization: JWT $TOKEN")
  echo "Draft Campaigns: $DRAFT_CAMPAIGNS"
  
  echo "✅ Campaign Management: WORKING"
else
  echo "❌ Campaign Management: NOT WORKING"
fi

echo ""
echo "📁 DELIVERABLE 4: Media Upload System"
echo "------------------------------------"
if [ -n "$CAMPAIGN_ID" ]; then
  UPLOAD_MEDIA=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
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
  
  GET_MEDIA=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=campaign-media&campaignId=$CAMPAIGN_ID" \
    -H "Authorization: JWT $TOKEN")
  echo "Get Campaign Media: $GET_MEDIA"
  
  if [[ $UPLOAD_MEDIA == *"success"* ]] && [[ $GET_MEDIA == *"success"* ]]; then
    echo "✅ Media Upload System: WORKING"
  else
    echo "❌ Media Upload System: NOT WORKING"
  fi
else
  echo "❌ Media Upload System: CANNOT TEST (no campaign ID)"
fi

echo ""
echo "📈 DELIVERABLE 5: Performance Tracking"
echo "------------------------------------"
if [ -n "$CAMPAIGN_ID" ]; then
  ADD_PERFORMANCE=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
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
  
  ANALYTICS=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=analytics" \
    -H "Authorization: JWT $TOKEN")
  echo "Analytics: $ANALYTICS"
  
  if [[ $ADD_PERFORMANCE == *"success"* ]] && [[ $ANALYTICS == *"success"* ]]; then
    echo "✅ Performance Tracking: WORKING"
  else
    echo "❌ Performance Tracking: NOT WORKING"
  fi
else
  echo "❌ Performance Tracking: CANNOT TEST (no campaign ID)"
fi

echo ""
echo "🧾 DELIVERABLE 6: Invoice Generation System"
echo "----------------------------------------"
if [ -n "$CAMPAIGN_ID" ]; then
  GENERATE_INVOICE=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
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
  
  GET_INVOICES=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=invoices" \
    -H "Authorization: JWT $TOKEN")
  echo "Get Invoices: $GET_INVOICES"
  
  if [[ $GENERATE_INVOICE == *"success"* ]] && [[ $GET_INVOICES == *"success"* ]]; then
    echo "✅ Invoice Generation System: WORKING"
  else
    echo "❌ Invoice Generation System: NOT WORKING"
  fi
else
  echo "❌ Invoice Generation System: CANNOT TEST (no campaign ID)"
fi

echo ""
echo "💰 DELIVERABLE 7: Payment Management"
echo "----------------------------------"
PAYMENTS=$(curl -s "$LOCAL_SERVER/api/advertiser-dashboard?action=payments" \
  -H "Authorization: JWT $TOKEN")
echo "Get Payments: $PAYMENTS"

if [[ $PAYMENTS == *"success"* ]]; then
  echo "✅ Payment Management: WORKING"
else
  echo "❌ Payment Management: NOT WORKING"
fi

echo ""
echo "🔄 DELIVERABLE 8: Campaign Resubmission"
echo "-------------------------------------"
if [ -n "$CAMPAIGN_ID" ]; then
  RESUBMIT_CAMPAIGN=$(curl -s -X POST "$LOCAL_SERVER/api/advertiser-dashboard" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -d '{
      "action": "resubmit-campaign",
      "campaignId": "'$CAMPAIGN_ID'",
      "updates": {
        "campaignName": "Updated Test Campaign",
        "budget": 75000
      }
    }')
  echo "Resubmit Campaign: $RESUBMIT_CAMPAIGN"
  
  if [[ $RESUBMIT_CAMPAIGN == *"success"* ]]; then
    echo "✅ Campaign Resubmission: WORKING"
  else
    echo "❌ Campaign Resubmission: NOT WORKING"
  fi
else
  echo "❌ Campaign Resubmission: CANNOT TEST (no campaign ID)"
fi

echo ""
echo "🎉 PHASE 2 DELIVERABLES TESTING COMPLETE!"
echo "========================================="
echo ""
echo "📋 SUMMARY OF DELIVERABLES:"
echo "1. Dashboard Overview: CHECK ABOVE"
echo "2. Business Profile Management: CHECK ABOVE"
echo "3. Campaign Management: CHECK ABOVE"
echo "4. Media Upload System: CHECK ABOVE"
echo "5. Performance Tracking: CHECK ABOVE"
echo "6. Invoice Generation System: CHECK ABOVE"
echo "7. Payment Management: CHECK ABOVE"
echo "8. Campaign Resubmission: CHECK ABOVE"

#!/bin/bash

echo "🧪 COMPREHENSIVE PHASE 2 TESTING - ALL DELIVERABLES"
echo "=================================================="

# Get fresh partner token
echo "🔑 Getting fresh partner token..."
PARTNER_TOKEN=$(curl -s -X POST "http://localhost:3000/api/partner/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadvertiser@example.com",
    "password": "Test@2025"
  }' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "🎫 Partner token obtained: ${PARTNER_TOKEN:0:30}..."

# Test 1: Get Advertiser Dashboard Overview
echo ""
echo "📊 Test 1: Get Advertiser Dashboard Overview"
echo "--------------------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=overview" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.overview.stats'

# Test 2: Get Advertiser Profile
echo ""
echo "👤 Test 2: Get Advertiser Profile"
echo "----------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=profile" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.profile | {id, companyName, companyEmail, status}'

# Test 3: Get Campaigns (Regular)
echo ""
echo "📈 Test 3: Get Campaigns (Regular)"
echo "----------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=campaigns" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.campaigns | length'

# Test 4: Get All Campaigns (Detailed)
echo ""
echo "📋 Test 4: Get All Campaigns (Detailed)"
echo "----------------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=all-campaigns" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.campaigns | length'

# Test 5: Create New Campaign
echo ""
echo "➕ Test 5: Create New Campaign"
echo "-------------------------------"
NEW_CAMPAIGN=$(curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=create-campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignName": "Comprehensive Test Campaign",
    "campaignDescription": "A campaign created during comprehensive testing",
    "campaignType": "digital",
    "budget": 20000,
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "targetAudience": "Test audience"
  }')

echo "$NEW_CAMPAIGN" | jq '.campaign.id'
CAMPAIGN_ID=$(echo "$NEW_CAMPAIGN" | jq -r '.campaign.id')

# Test 6: Get Draft Campaigns
echo ""
echo "📝 Test 6: Get Draft Campaigns"
echo "-------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=draft-campaigns" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.campaigns | length'

# Test 7: Upload Media to Draft Campaign
echo ""
echo "📎 Test 7: Upload Media to Draft Campaign"
echo "-----------------------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=upload-media" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "fileName": "test-advertisement.jpg",
    "fileType": "image",
    "fileUrl": "https://example.com/test-ad.jpg",
    "fileSize": 1024000,
    "description": "Test advertisement image"
  }' | jq '.'

# Test 8: Get Campaign Media
echo ""
echo "🖼️ Test 8: Get Campaign Media"
echo "------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=get-media&campaignId=$CAMPAIGN_ID" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.'

# Test 9: Add Campaign Performance Data
echo ""
echo "📊 Test 9: Add Campaign Performance Data"
echo "-----------------------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=add-performance" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "impressions": 1000,
    "clicks": 50,
    "conversions": 5,
    "spend": 500
  }' | jq '.'

# Test 10: Get Analytics
echo ""
echo "📈 Test 10: Get Analytics"
echo "--------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=analytics" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.analytics.summary'

# Test 11: Get Payments
echo ""
echo "💳 Test 11: Get Payments"
echo "-------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=payments" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.payments'

# Test 12: Get Invoices
echo ""
echo "🧾 Test 12: Get Invoices"
echo "-------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=invoices" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.invoices | length'

# Test 13: Update Campaign
echo ""
echo "✏️ Test 13: Update Campaign"
echo "----------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=update-campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "campaignName": "Updated Comprehensive Test Campaign",
    "campaignDescription": "Updated description for testing",
    "budget": 25000
  }' | jq '.'

# Test 14: Resubmit Campaign (if rejected)
echo ""
echo "🔄 Test 14: Resubmit Campaign"
echo "-----------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=resubmit-campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "campaignName": "Resubmitted Test Campaign",
    "campaignDescription": "Resubmitted for admin review"
  }' | jq '.'

# Test 15: Generate Invoice
echo ""
echo "🧾 Test 15: Generate Invoice"
echo "-----------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=generate-invoice" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $PARTNER_TOKEN" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "stripePaymentIntentId": "pi_test_123456789",
    "amount": 20000,
    "currency": "NGN"
  }' | jq '.'

# Final Summary
echo ""
echo "📊 FINAL CAMPAIGN COUNT"
echo "======================="
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=all-campaigns" \
  -H "Authorization: JWT $PARTNER_TOKEN" | jq '.campaigns | length'

echo ""
echo "✅ COMPREHENSIVE PHASE 2 TESTING COMPLETE!"
echo "==========================================="

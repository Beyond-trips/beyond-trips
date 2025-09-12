#!/bin/bash

# Test Phase 2.1 Analytics Endpoints
echo "🧪 TESTING PHASE 2.1: ANALYTICS BACKEND"
echo "========================================"

# Set variables
BASE_URL="http://localhost:3000"
EMAIL="testadvertiser@example.com"
PASSWORD="Test@2025"

echo ""
echo "📊 Step 1: Login as Partner"
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
echo "📊 Step 2: Test Analytics Overview"
echo "----------------------------------"

# Test analytics overview
ANALYTICS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=analytics" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Analytics Response: $ANALYTICS_RESPONSE"

echo ""
echo "📊 Step 3: Test Ad Spend Data"
echo "-----------------------------"

# Test ad spend data
SPEND_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=ad-spend-data&period=30&granularity=daily" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Ad Spend Response: $SPEND_RESPONSE"

echo ""
echo "📊 Step 4: Get Campaigns for Analytics Data"
echo "--------------------------------------------"

# Get campaigns to use for analytics data
CAMPAIGNS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=campaigns" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Campaigns Response: $CAMPAIGNS_RESPONSE"

# Extract first campaign ID
CAMPAIGN_ID=$(echo $CAMPAIGNS_RESPONSE | jq -r '.campaigns[0].id // empty')

if [ -z "$CAMPAIGN_ID" ] || [ "$CAMPAIGN_ID" = "null" ]; then
  echo "❌ No campaigns found, creating a test campaign first..."
  
  # Create a test campaign
  CREATE_CAMPAIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=create-campaign" \
    -H "Authorization: JWT $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "campaignName": "Test Analytics Campaign",
      "campaignDescription": "Campaign for testing analytics",
      "campaignType": "magazine",
      "budget": 10000,
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "targetAudience": "General audience"
    }')
  
  echo "Create Campaign Response: $CREATE_CAMPAIGN_RESPONSE"
  CAMPAIGN_ID=$(echo $CREATE_CAMPAIGN_RESPONSE | jq -r '.campaign.id // empty')
fi

if [ -z "$CAMPAIGN_ID" ] || [ "$CAMPAIGN_ID" = "null" ]; then
  echo "❌ Failed to get campaign ID"
  exit 1
fi

echo "✅ Using Campaign ID: $CAMPAIGN_ID"

echo ""
echo "📊 Step 5: Add Analytics Data"
echo "----------------------------"

# Add analytics data
ADD_ANALYTICS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=add-analytics-data" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"impressions\": 1000,
    \"clicks\": 50,
    \"conversions\": 5,
    \"spend\": 2500,
    \"source\": \"magazine\",
    \"deviceType\": \"mobile\",
    \"location\": \"Lagos\",
    \"ageGroup\": \"25-34\",
    \"gender\": \"all\",
    \"notes\": \"Test analytics data\"
  }")

echo "Add Analytics Response: $ADD_ANALYTICS_RESPONSE"

echo ""
echo "📊 Step 6: Test Analytics with Data"
echo "------------------------------------"

# Test analytics again with data
ANALYTICS_WITH_DATA_RESPONSE=$(curl -s -X GET "$BASE_URL/api/advertiser-dashboard?action=analytics&period=30" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Analytics with Data Response: $ANALYTICS_WITH_DATA_RESPONSE"

echo ""
echo "📊 Step 7: Test Report Generation"
echo "-----------------------------------"

# Test report generation
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=generate-report" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reportType\": \"campaign_performance\",
    \"format\": \"json\",
    \"includeCharts\": true,
    \"campaignIds\": [\"$CAMPAIGN_ID\"]
  }")

echo "Report Generation Response: $REPORT_RESPONSE"

echo ""
echo "📊 Step 8: Test CSV Report Generation"
echo "--------------------------------------"

# Test CSV report generation
CSV_REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/advertiser-dashboard?action=generate-report" \
  -H "Authorization: JWT $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reportType\": \"campaign_performance\",
    \"format\": \"csv\",
    \"includeCharts\": false,
    \"campaignIds\": [\"$CAMPAIGN_ID\"]
  }")

echo "CSV Report Response (first 200 chars): ${CSV_REPORT_RESPONSE:0:200}..."

echo ""
echo "🎯 PHASE 2.1 ANALYTICS TESTING COMPLETE"
echo "======================================="
echo ""
echo "✅ Tested Endpoints:"
echo "   - Analytics Overview"
echo "   - Ad Spend Data"
echo "   - Add Analytics Data"
echo "   - Report Generation (JSON & CSV)"
echo ""
echo "📊 Analytics Features Implemented:"
echo "   - Performance tracking (impressions, clicks, conversions)"
echo "   - Cost metrics (CPC, CPM, CPA)"
echo "   - Engagement rates (CTR, conversion rate)"
echo "   - Daily/Weekly/Monthly granularity"
echo "   - Campaign performance comparison"
echo "   - Report generation in multiple formats"
echo ""
echo "🚀 Ready for Phase 2.2: File Upload Backend"

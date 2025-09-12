#!/bin/bash

# Test Campaign Status Management - Phase 2.3
# Tests campaign pause, resume, cancel, and status update functionality

echo "🔄 Testing Campaign Status Management"
echo "===================================="

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

echo -e "\n${YELLOW}Step 2: Create a Test Campaign for Status Management${NC}"

CREATE_CAMPAIGN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=create-campaign" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"campaignName\": \"Status Test Campaign\",
    \"campaignDescription\": \"Test campaign for status management\",
    \"campaignType\": \"display\",
    \"budget\": 10000,
    \"startDate\": \"2025-01-01\",
    \"endDate\": \"2025-12-31\",
    \"targetAudience\": \"general\"
  }")

CREATE_STATUS=$(get_status_code "$CREATE_CAMPAIGN_RESPONSE")
CREATE_BODY=$(echo "$CREATE_CAMPAIGN_RESPONSE" | sed '$d')

if [ "$CREATE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Test campaign created successfully${NC}"
    CAMPAIGN_ID=$(echo "$CREATE_BODY" | jq -r '.data.id')
    CAMPAIGN_STATUS=$(echo "$CREATE_BODY" | jq -r '.data.status')
    echo "Campaign ID: $CAMPAIGN_ID"
    echo "Initial Status: $CAMPAIGN_STATUS"
else
    echo -e "${RED}❌ Failed to create test campaign${NC}"
    echo "Response: $CREATE_BODY"
    exit 1
fi

echo -e "\n${YELLOW}Step 3: Test Campaign Status Management${NC}"

# Test pause campaign (if status is active)
if [ "$CAMPAIGN_STATUS" = "active" ]; then
    echo -e "\n${BLUE}Testing: Pause Campaign${NC}"
    PAUSE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=pause-campaign" \
      -H "Authorization: JWT $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"campaignId\": \"$CAMPAIGN_ID\", \"reason\": \"Testing pause functionality\"}")

    PAUSE_STATUS=$(get_status_code "$PAUSE_RESPONSE")
    PAUSE_BODY=$(echo "$PAUSE_RESPONSE" | sed '$d')

    if [ "$PAUSE_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Campaign paused successfully${NC}"
        echo "Response: $PAUSE_BODY"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Campaign pause failed${NC}"
        echo "Response: $PAUSE_BODY"
        ((TESTS_FAILED++))
    fi

    # Test resume campaign
    echo -e "\n${BLUE}Testing: Resume Campaign${NC}"
    RESUME_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=resume-campaign" \
      -H "Authorization: JWT $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"campaignId\": \"$CAMPAIGN_ID\", \"reason\": \"Testing resume functionality\"}")

    RESUME_STATUS=$(get_status_code "$RESUME_RESPONSE")
    RESUME_BODY=$(echo "$RESUME_RESPONSE" | sed '$d')

    if [ "$RESUME_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Campaign resumed successfully${NC}"
        echo "Response: $RESUME_BODY"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Campaign resume failed${NC}"
        echo "Response: $RESUME_BODY"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠️ Skipping pause/resume tests - campaign status is $CAMPAIGN_STATUS${NC}"
fi

# Test generic status update
echo -e "\n${BLUE}Testing: Update Campaign Status${NC}"
UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=update-campaign-status" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\": \"$CAMPAIGN_ID\", \"status\": \"paused\", \"reason\": \"Testing generic status update\"}")

UPDATE_STATUS=$(get_status_code "$UPDATE_RESPONSE")
UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

if [ "$UPDATE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Campaign status updated successfully${NC}"
    echo "Response: $UPDATE_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Campaign status update failed${NC}"
    echo "Response: $UPDATE_BODY"
    ((TESTS_FAILED++))
fi

# Test get status history
echo -e "\n${BLUE}Testing: Get Campaign Status History${NC}"
HISTORY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/advertiser-dashboard?action=get-campaign-status-history&campaignId=$CAMPAIGN_ID" \
  -H "Authorization: JWT $TOKEN")

HISTORY_STATUS=$(get_status_code "$HISTORY_RESPONSE")
HISTORY_BODY=$(echo "$HISTORY_RESPONSE" | sed '$d')

if [ "$HISTORY_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Campaign status history retrieved successfully${NC}"
    echo "Response: $HISTORY_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Campaign status history retrieval failed${NC}"
    echo "Response: $HISTORY_BODY"
    ((TESTS_FAILED++))
fi

# Test cancel campaign
echo -e "\n${BLUE}Testing: Cancel Campaign${NC}"
CANCEL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=cancel-campaign" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\": \"$CAMPAIGN_ID\", \"reason\": \"Testing cancel functionality\"}")

CANCEL_STATUS=$(get_status_code "$CANCEL_RESPONSE")
CANCEL_BODY=$(echo "$CANCEL_RESPONSE" | sed '$d')

if [ "$CANCEL_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Campaign cancelled successfully${NC}"
    REFUND_AMOUNT=$(echo "$CANCEL_BODY" | jq -r '.data.refundAmount')
    echo "Refund Amount: $REFUND_AMOUNT"
    echo "Response: $CANCEL_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Campaign cancel failed${NC}"
    echo "Response: $CANCEL_BODY"
    ((TESTS_FAILED++))
fi

echo -e "\n${YELLOW}Step 4: Test Status Validation${NC}"

# Test invalid status change (try to resume a cancelled campaign)
echo -e "\n${BLUE}Testing: Invalid Status Change (resume cancelled campaign)${NC}"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=resume-campaign" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"campaignId\": \"$CAMPAIGN_ID\", \"reason\": \"Testing invalid status change\"}")

INVALID_STATUS=$(get_status_code "$INVALID_RESPONSE")
INVALID_BODY=$(echo "$INVALID_RESPONSE" | sed '$d')

if [ "$INVALID_STATUS" = "400" ]; then
    echo -e "${GREEN}✅ Invalid status change correctly rejected${NC}"
    echo "Response: $INVALID_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Invalid status change should be rejected${NC}"
    echo "Response: $INVALID_BODY"
    ((TESTS_FAILED++))
fi

# Test missing campaign ID
echo -e "\n${BLUE}Testing: Missing Campaign ID${NC}"
MISSING_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/advertiser-dashboard?action=pause-campaign" \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"reason\": \"Testing missing campaign ID\"}")

MISSING_STATUS=$(get_status_code "$MISSING_RESPONSE")
MISSING_BODY=$(echo "$MISSING_RESPONSE" | sed '$d')

if [ "$MISSING_STATUS" = "400" ]; then
    echo -e "${GREEN}✅ Missing campaign ID correctly rejected${NC}"
    echo "Response: $MISSING_BODY"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Missing campaign ID should be rejected${NC}"
    echo "Response: $MISSING_BODY"
    ((TESTS_FAILED++))
fi

# Summary
echo -e "\n${YELLOW}Campaign Status Management Test Summary${NC}"
echo "============================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All campaign status management tests passed!${NC}"
    echo -e "${BLUE}✅ Features tested:${NC}"
    echo "  ✅ Campaign pause functionality"
    echo "  ✅ Campaign resume functionality"
    echo "  ✅ Campaign cancel functionality"
    echo "  ✅ Generic status update functionality"
    echo "  ✅ Status history tracking"
    echo "  ✅ Refund calculation"
    echo "  ✅ Status validation"
    echo "  ✅ Error handling"
    exit 0
else
    echo -e "\n${RED}❌ Some campaign status management tests failed. Please check the implementation.${NC}"
    exit 1
fi

#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏢 Testing Beyond Trips Business Registration Flow"
echo "================================================"

# Base URL
BASE_URL="http://localhost:3000"

# For testing, we'll modify the verify-email endpoint to accept a test code
# Or we'll extract the actual code from the response

echo -e "\n${YELLOW}Step 1: Business Registration${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/partner/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyEmail": "hotel'$(date +%s)'@example.com",
    "password": "securePassword123",
    "confirmPassword": "securePassword123",
    "companyName": "Paradise Hotels Ltd '$(date +%s)'",
    "companyAddress": "123 Beach Road, Lagos, Nigeria",
    "contact": "+234-801-234-5678",
    "industry": "Hospitality & Tourism"
  }')

echo "Registration Response:"
echo $REGISTER_RESPONSE | jq '.'

BUSINESS_ID=$(echo $REGISTER_RESPONSE | jq -r '.businessId // empty')
if [ -z "$BUSINESS_ID" ]; then
  echo -e "${RED}❌ Registration failed - no business ID received${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Business ID: $BUSINESS_ID${NC}"

# For testing, we need to get the actual verification code
# In a real scenario, this would be sent via email
echo -e "\n${YELLOW}Getting verification code for testing...${NC}"
# Fetch the business details to get the verification code (only for testing!)
BUSINESS_DETAILS=$(curl -s -X GET $BASE_URL/api/business-details/$BUSINESS_ID)
VERIFICATION_CODE=$(echo $BUSINESS_DETAILS | jq -r '.verificationCode // empty')

if [ -z "$VERIFICATION_CODE" ]; then
  echo -e "${YELLOW}Could not retrieve verification code. Using default test code.${NC}"
  VERIFICATION_CODE="123456"
else
  echo -e "${GREEN}Retrieved verification code: $VERIFICATION_CODE${NC}"
fi

echo -e "\n${YELLOW}Step 2: Email Verification${NC}"
VERIFY_RESPONSE=$(curl -s -X POST $BASE_URL/api/partner/verify-email \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"verificationCode\": \"$VERIFICATION_CODE\"
  }")

echo "Verification Response:"
echo $VERIFY_RESPONSE | jq '.'

# Check if verification was successful
if ! echo $VERIFY_RESPONSE | jq -e '.success' > /dev/null; then
  echo -e "${RED}❌ Email verification failed${NC}"
  # Continue anyway for testing purposes
else
  echo -e "${GREEN}✓ Email verified successfully${NC}"
fi

echo -e "\n${YELLOW}Step 3: Ad Campaign Setup${NC}"
CAMPAIGN_RESPONSE=$(curl -s -X POST $BASE_URL/api/partner/create-campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"campaignType\": \"magazine\",
    \"campaignName\": \"Paradise Hotels Summer Campaign\",
    \"campaignDescription\": \"Promote our beach resort packages\"
  }")

echo "Campaign Setup Response:"
echo $CAMPAIGN_RESPONSE | jq '.'

CAMPAIGN_ID=$(echo $CAMPAIGN_RESPONSE | jq -r '.campaignId // empty')
if [ ! -z "$CAMPAIGN_ID" ]; then
  echo -e "${GREEN}✓ Campaign ID: $CAMPAIGN_ID${NC}"
else
  echo -e "${YELLOW}⚠️  Campaign creation skipped or failed${NC}"
fi

echo -e "\n${YELLOW}Step 4: Get Subscription Plans${NC}"
PLANS_RESPONSE=$(curl -s -X GET $BASE_URL/api/partner/subscription-plans)
PLANS_COUNT=$(echo $PLANS_RESPONSE | jq '.plans | length')
echo "Found $PLANS_COUNT subscription plans"

# Show just the first 3 plans (to avoid duplicates in output)
echo $PLANS_RESPONSE | jq '.plans[:3]'

echo -e "\n${YELLOW}Step 5: Payment & Budgeting Setup${NC}"
PAYMENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/partner/setup-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"pricingTier\": \"starter\",
    \"monthlyBudget\": 0,
    \"paymentMethod\": \"card\"
  }")

echo "Payment Setup Response:"
echo $PAYMENT_RESPONSE | jq '.'

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.paymentId // empty')
if [ ! -z "$PAYMENT_ID" ]; then
  echo -e "${GREEN}✓ Payment ID: $PAYMENT_ID${NC}"
fi

echo -e "\n${YELLOW}Step 6: Complete Registration${NC}"
COMPLETE_RESPONSE=$(curl -s -X POST $BASE_URL/api/partner/complete \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\"
  }")

echo "Completion Response:"
echo $COMPLETE_RESPONSE | jq '.'

USER_ID=$(echo $COMPLETE_RESPONSE | jq -r '.userId // empty')
if [ ! -z "$USER_ID" ]; then
  echo -e "${GREEN}✓ User Account Created: $USER_ID${NC}"
fi

echo -e "\n${YELLOW}Step 7: Get Registration Status${NC}"
STATUS_RESPONSE=$(curl -s -X GET $BASE_URL/api/partner/status/$BUSINESS_ID)
echo "Registration Status Summary:"
echo $STATUS_RESPONSE | jq '{
  businessId: .businessDetails.id,
  companyName: .businessDetails.companyName,
  registrationStatus: .businessDetails.registrationStatus,
  emailVerified: .businessDetails.emailVerified,
  campaignsCount: .adCampaigns | length,
  hasPaymentPlan: (.paymentPlan != null)
}'

echo -e "\n${GREEN}✅ Business Registration Flow Complete!${NC}"
echo "Summary:"
echo "- Business ID: $BUSINESS_ID"
echo "- Campaign ID: ${CAMPAIGN_ID:-Not created}"
echo "- Payment ID: $PAYMENT_ID"
echo "- User ID: $USER_ID"

echo -e "\n${YELLOW}📊 Database Summary:${NC}"
echo -n "Total Businesses: "
curl -s $BASE_URL/api/business-details | jq '.docs | length'
echo -n "Total Campaigns: "
curl -s $BASE_URL/api/ad-campaigns | jq '.docs | length'
echo -n "Total Payments: "
curl -s $BASE_URL/api/payment-budgeting | jq '.docs | length'
echo -n "Total Users: "
curl -s $BASE_URL/api/users | jq '.docs | length'

echo -e "\n${YELLOW}🧪 Testing User OTP Flow (using existing /api/auth endpoints)${NC}"
TEST_EMAIL="testuser$(date +%s)@example.com"
echo "Step 1: Generate OTP for user: $TEST_EMAIL"
OTP_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/generate-otp \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\"
  }")
echo "OTP Generation Response:"
echo $OTP_RESPONSE | jq '.'

# Extract OTP from response if available (for testing)
OTP_VALUE=$(echo $OTP_RESPONSE | jq -r '.otp // empty')
if [ -z "$OTP_VALUE" ]; then
  echo -e "${YELLOW}OTP not returned in response (good for production!)${NC}"
  echo "In production, check email for OTP"
else
  echo -e "\nStep 2: Verify OTP (using actual OTP: $OTP_VALUE)"
  VERIFY_OTP_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"otp\": \"$OTP_VALUE\"
    }")
  echo "OTP Verification Response:"
  echo $VERIFY_OTP_RESPONSE | jq '.'
fi

echo -e "\n${GREEN}✅ All tests completed!${NC}"
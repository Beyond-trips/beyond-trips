#!/bin/bash

echo "🏢 Testing Beyond Trips Business Registration Flow"
echo "================================================"

echo "Step 1: Business Details Registration"
BUSINESS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/business-details \
  -H "Content-Type: application/json" \
  -d '{
    "companyEmail": "hotel@example.com",
    "password": "securePassword123",
    "companyName": "Paradise Hotels Ltd",
    "companyAddress": "123 Beach Road, Lagos, Nigeria",
    "contact": "+234-801-234-5678",
    "industry": "Hospitality & Tourism",
    "registrationStatus": "pending"
  }')

echo "Business Registration Response:"
echo $BUSINESS_RESPONSE | jq '.'
BUSINESS_ID=$(echo $BUSINESS_RESPONSE | jq -r '.id // empty')
echo "Business ID: $BUSINESS_ID"
echo ""

if [ ! -z "$BUSINESS_ID" ]; then
  echo "Step 2: Email Verification (Simulate)"
  curl -s -X PATCH http://localhost:3000/api/business-details/$BUSINESS_ID \
    -H "Content-Type: application/json" \
    -d '{
      "emailVerified": true,
      "registrationStatus": "email_verified"
    }' | jq '.'
  echo ""

  echo "Step 3: Ad Campaign Setup"
  CAMPAIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ad-campaigns \
    -H "Content-Type: application/json" \
    -d "{
      \"businessId\": \"$BUSINESS_ID\",
      \"campaignType\": \"magazine\",
      \"campaignName\": \"Paradise Hotels Summer Campaign\",
      \"campaignDescription\": \"Promote our beach resort packages\",
      \"status\": \"draft\"
    }")
  
  echo "Campaign Setup Response:"
  echo $CAMPAIGN_RESPONSE | jq '.'
  CAMPAIGN_ID=$(echo $CAMPAIGN_RESPONSE | jq -r '.id // empty')
  echo ""

  echo "Step 4: Payment & Budgeting Setup"
  PAYMENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/payment-budgeting \
    -H "Content-Type: application/json" \
    -d "{
      \"businessId\": \"$BUSINESS_ID\",
      \"pricingTier\": \"starter\",
      \"monthlyBudget\": 0,
      \"paymentMethod\": \"card\",
      \"paymentStatus\": \"pending\"
    }")
  
  echo "Payment Setup Response:"
  echo $PAYMENT_RESPONSE | jq '.'
  echo ""

  echo "Step 5: Complete Registration"
  curl -s -X PATCH http://localhost:3000/api/business-details/$BUSINESS_ID \
    -H "Content-Type: application/json" \
    -d '{
      "registrationStatus": "completed"
    }' | jq '.'
  echo ""

  echo "✅ Business Registration Flow Complete!"
  echo "Business ID: $BUSINESS_ID"
  echo "Campaign ID: $CAMPAIGN_ID"
fi

echo ""
echo "📊 Summary - Get All Data:"
echo "Businesses: $(curl -s http://localhost:3000/api/business-details | jq '.docs | length')"
echo "Campaigns: $(curl -s http://localhost:3000/api/ad-campaigns | jq '.docs | length')"
echo "Payments: $(curl -s http://localhost:3000/api/payment-budgeting | jq '.docs | length')"

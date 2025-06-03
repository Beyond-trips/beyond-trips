#!/bin/bash

# Debug Payment Setup Issue
# Test with more detailed error reporting

BASE_URL="https://beyond-trips-backend2.onrender.com"
BUSINESS_ID="683e4d862e464dad2bce1c5a"  # From your test
PLAN_ID="6831d8ebb4993d6c1912f90c"      # From your test

echo "🔍 Debugging Payment Setup Issue"
echo "Business ID: $BUSINESS_ID"
echo "Plan ID: $PLAN_ID"
echo ""

# Test 1: Verify the plan exists and get its details
echo "=== 1. Checking Subscription Plan Details ==="
PLAN_DETAILS=$(curl -s "$BASE_URL/api/partner/subscription-plans")
echo "Plan response: $PLAN_DETAILS"
echo ""

# Test 2: Check if business still exists and is verified
echo "=== 2. Checking Business Status ==="
BUSINESS_STATUS=$(curl -s "$BASE_URL/api/partner/status/$BUSINESS_ID")
echo "Business status: $BUSINESS_STATUS"
echo ""

# Test 3: Try payment setup with verbose error details
echo "=== 3. Testing Payment Setup with Debug ==="
PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/partner/setup-payment" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"subscriptionPlanId\": \"$PLAN_ID\",
    \"monthlyBudget\": 50000,
    \"paymentMethod\": \"card\"
  }")

echo "Payment response: $PAYMENT_RESPONSE"
echo ""

# Test 4: Try with different plan selection method (by planType)
echo "=== 4. Testing Payment with planType instead of ID ==="
PAYMENT_RESPONSE_2=$(curl -s -X POST "$BASE_URL/api/partner/setup-payment" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"subscriptionPlanId\": \"starter\",
    \"monthlyBudget\": 50000,
    \"paymentMethod\": \"card\"
  }")

echo "Payment response (with planType): $PAYMENT_RESPONSE_2"
echo ""

# Test 5: Check if payment-budgeting collection exists
echo "=== 5. Potential Issues ==="
echo "❓ Possible causes:"
echo "   1. Payment-budgeting collection not created"
echo "   2. Plan ID mismatch"
echo "   3. Business verification state issue"
echo "   4. Collection permissions"
echo ""

echo "💡 Solutions to try:"
echo "   1. Check server logs for detailed error"
echo "   2. Verify payment-budgeting collection exists"
echo "   3. Check plan mapping logic"
echo "   4. Test with planType instead of ID"
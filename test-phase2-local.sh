#!/bin/bash

echo "🧪 Testing Phase 2 Advertiser Dashboard Endpoints Locally"
echo "=================================================="

# First, let's try to get a token by creating a simple test
echo "📝 Creating test business profile directly..."

# Get admin token first
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "feniola07@gmail.com", "password": "Test@2025"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "🔑 Admin token obtained: ${ADMIN_TOKEN:0:20}..."

# Create a business profile directly using admin privileges
echo "🏢 Creating business profile..."
BUSINESS_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/business-details" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $ADMIN_TOKEN" \
  -d '{
    "companyName": "Test Advertiser Business",
    "companyEmail": "testadvertiser@example.com",
    "companyAddress": "123 Test Street, Lagos, Nigeria",
    "contact": "+2348012345678",
    "industry": "Technology",
    "password": "$2b$12$kGb8B8.oKXSqMSBlv3IlXOlgzsJ68W/DutRKqYQst.Ug1Ijwtz70i",
    "emailVerified": true,
    "registrationStatus": "completed",
    "registrationDate": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }')

echo "📊 Business creation response: $BUSINESS_RESPONSE"

# Use existing business ID from previous test
BUSINESS_ID="68bc52902261f998c8550197"
echo "🆔 Using existing Business ID: $BUSINESS_ID"

# Create a mock JWT token for the business (this is just for testing)
echo "🔐 Creating mock JWT token for testing..."
MOCK_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { 
    id: '$BUSINESS_ID',
    email: 'testadvertiser@example.com',
    role: 'partner',
    partnerId: '$BUSINESS_ID'
  },
  '096fcad00254ab7e247c1a34cbfa901d5a5b0b32e86e7144afbfd113cecd7a7b97b0040163132e732e87c9dc1efc09549b0db84d9aa86045a7b63d94b969cfc3',
  { expiresIn: '7d' }
);
console.log(token);
")

echo "🎫 Mock token created: ${MOCK_TOKEN:0:30}..."

# Test 1: Get Advertiser Dashboard Overview
echo ""
echo "📊 Test 1: Get Advertiser Dashboard Overview"
echo "--------------------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=overview" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 2: Get Advertiser Profile
echo ""
echo "👤 Test 2: Get Advertiser Profile"
echo "----------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=profile" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 3: Get Campaigns
echo ""
echo "📈 Test 3: Get Campaigns"
echo "------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=campaigns" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 4: Create Campaign
echo ""
echo "➕ Test 4: Create Campaign"
echo "--------------------------"
curl -s -X POST "http://localhost:3000/api/advertiser-dashboard?action=create-campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $MOCK_TOKEN" \
  -d '{
    "campaignName": "Test Campaign",
    "campaignDescription": "This is a test campaign",
    "campaignType": "display",
    "budget": 10000,
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "targetAudience": "General"
  }' | jq '.'

# Test 5: Get Payments
echo ""
echo "💳 Test 5: Get Payments"
echo "----------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=payments" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 6: Get Analytics
echo ""
echo "📊 Test 6: Get Analytics"
echo "------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=analytics" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 7: Get Draft Campaigns
echo ""
echo "📝 Test 7: Get Draft Campaigns"
echo "-------------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=draft-campaigns" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 8: Get All Campaigns
echo ""
echo "📋 Test 8: Get All Campaigns"
echo "-----------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=all-campaigns" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

# Test 9: Get Invoices
echo ""
echo "🧾 Test 9: Get Invoices"
echo "------------------------"
curl -s -X GET "http://localhost:3000/api/advertiser-dashboard?action=invoices" \
  -H "Authorization: JWT $MOCK_TOKEN" | jq '.'

echo ""
echo "✅ Phase 2 Testing Complete!"
echo "============================="

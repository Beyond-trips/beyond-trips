#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

show_menu() {
    echo -e "\n${BLUE}Beyond Trips Test Helper${NC}"
    echo "========================"
    echo "1) Create test subscription plans"
    echo "2) Create test user"
    echo "3) Clean all test data"
    echo "4) Show current data counts"
    echo "5) Test specific endpoint"
    echo "6) Exit"
    echo -e "Select an option: \c"
}

create_subscription_plans() {
    echo -e "\n${YELLOW}Creating subscription plans...${NC}"
    
    # Starter Plan
    curl -s -X POST $BASE_URL/api/subscription-plans \
        -H "Content-Type: application/json" \
        -d '{
            "planName": "Starter Plan",
            "planType": "starter",
            "price": 0,
            "currency": "NGN",
            "billingCycle": "monthly",
            "description": "Perfect for small businesses just starting out",
            "features": [
                {"feature": "Up to 10 campaigns"},
                {"feature": "Basic analytics"},
                {"feature": "Email support"}
            ],
            "isActive": true
        }' | jq '.'
    
    # Standard Plan
    curl -s -X POST $BASE_URL/api/subscription-plans \
        -H "Content-Type: application/json" \
        -d '{
            "planName": "Standard Plan",
            "planType": "standard",
            "price": 50000,
            "currency": "NGN",
            "billingCycle": "monthly",
            "description": "For growing businesses",
            "features": [
                {"feature": "Up to 50 campaigns"},
                {"feature": "Advanced analytics"},
                {"feature": "Priority email support"},
                {"feature": "Custom branding"}
            ],
            "isActive": true
        }' | jq '.'
    
    # Pro Plan
    curl -s -X POST $BASE_URL/api/subscription-plans \
        -H "Content-Type: application/json" \
        -d '{
            "planName": "Pro Plan",
            "planType": "pro",
            "price": 150000,
            "currency": "NGN",
            "billingCycle": "monthly",
            "description": "For enterprise businesses",
            "features": [
                {"feature": "Unlimited campaigns"},
                {"feature": "Real-time analytics"},
                {"feature": "24/7 phone support"},
                {"feature": "Custom integrations"},
                {"feature": "Dedicated account manager"}
            ],
            "isActive": true
        }' | jq '.'
    
    echo -e "${GREEN}✓ Subscription plans created${NC}"
}

create_test_user() {
    echo -e "\n${YELLOW}Creating test user...${NC}"
    
    curl -s -X POST $BASE_URL/api/users \
        -H "Content-Type: application/json" \
        -d '{
            "email": "testuser@example.com",
            "password": "testPassword123",
            "username": "testuser",
            "role": "user",
            "emailVerified": false
        }' | jq '.'
    
    echo -e "${GREEN}✓ Test user created${NC}"
}

clean_test_data() {
    echo -e "\n${RED}⚠️  This will delete all data in the following collections:${NC}"
    echo "- business-details"
    echo "- ad-campaigns"
    echo "- payment-budgeting"
    echo "- subscription-plans"
    echo "- users (except admin)"
    echo -e "\nAre you sure? (y/N): \c"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "\n${YELLOW}Cleaning test data...${NC}"
        
        # Note: This is a simplified version. In reality, you'd need to:
        # 1. Get all IDs first
        # 2. Delete each record individually
        # Or implement a bulk delete endpoint
        
        echo "Please implement bulk delete endpoints or use Payload Admin UI"
        echo -e "${YELLOW}Alternatively, you can reset the database${NC}"
    else
        echo "Cleanup cancelled"
    fi
}

show_data_counts() {
    echo -e "\n${YELLOW}Current Data Counts:${NC}"
    
    echo -n "Business Details: "
    curl -s $BASE_URL/api/business-details | jq '.docs | length'
    
    echo -n "Ad Campaigns: "
    curl -s $BASE_URL/api/ad-campaigns | jq '.docs | length'
    
    echo -n "Payment & Budgeting: "
    curl -s $BASE_URL/api/payment-budgeting | jq '.docs | length'
    
    echo -n "Subscription Plans: "
    curl -s $BASE_URL/api/subscription-plans | jq '.docs | length'
    
    echo -n "Users: "
    curl -s $BASE_URL/api/users | jq '.docs | length'
}

test_specific_endpoint() {
    echo -e "\n${YELLOW}Select endpoint to test:${NC}"
    echo "1) Start Partner Registration"
    echo "2) Verify Email"
    echo "3) Resend Verification Code"
    echo "4) Create Ad Campaign"
    echo "5) Get Subscription Plans"
    echo "6) Setup Payment"
    echo "7) Complete Registration"
    echo "8) Get Registration Status"
    echo "9) Generate User OTP"
    echo "10) Verify User OTP"
    echo -e "Select: \c"
    read -r choice
    
    case $choice in
        1)
            echo -e "\n${YELLOW}Testing Partner Registration...${NC}"
            curl -s -X POST $BASE_URL/api/partner/register \
                -H "Content-Type: application/json" \
                -d '{
                    "companyEmail": "test'$(date +%s)'@example.com",
                    "password": "testPassword123",
                    "confirmPassword": "testPassword123",
                    "companyName": "Test Company '$(date +%s)'",
                    "companyAddress": "123 Test Street",
                    "contact": "+234-123-456-7890",
                    "industry": "Technology"
                }' | jq '.'
            ;;
        2)
            echo -e "Enter Business ID: \c"
            read -r business_id
            echo -e "Enter Verification Code: \c"
            read -r code
            curl -s -X POST $BASE_URL/api/partner/verify-email \
                -H "Content-Type: application/json" \
                -d "{
                    \"businessId\": \"$business_id\",
                    \"verificationCode\": \"$code\"
                }" | jq '.'
            ;;
        # Add more cases as needed
        *)
            echo "Invalid choice"
            ;;
    esac
}

# Main loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1) create_subscription_plans ;;
        2) create_test_user ;;
        3) clean_test_data ;;
        4) show_data_counts ;;
        5) test_specific_endpoint ;;
        6) 
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
done
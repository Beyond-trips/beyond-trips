#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

echo -e "${YELLOW}Checking for duplicate subscription plans...${NC}"

# Get all subscription plans
PLANS=$(curl -s $BASE_URL/api/subscription-plans)
TOTAL_PLANS=$(echo $PLANS | jq '.docs | length')

echo "Found $TOTAL_PLANS subscription plans"

# Group by planType and show counts
echo -e "\n${YELLOW}Plan distribution:${NC}"
echo $PLANS | jq '.docs | group_by(.planType) | map({type: .[0].planType, count: length})'

# Keep only the most recent of each plan type
echo -e "\n${YELLOW}Keeping only the most recent plan of each type...${NC}"

# Get unique plan types
PLAN_TYPES=$(echo $PLANS | jq -r '.docs | map(.planType) | unique | .[]')

for PLAN_TYPE in $PLAN_TYPES; do
  echo -e "\nProcessing $PLAN_TYPE plans..."
  
  # Get all plans of this type, sorted by createdAt descending
  PLANS_OF_TYPE=$(echo $PLANS | jq -r --arg type "$PLAN_TYPE" '.docs | map(select(.planType == $type)) | sort_by(.createdAt) | reverse')
  
  # Keep the first one (most recent)
  KEEP_ID=$(echo $PLANS_OF_TYPE | jq -r '.[0].id')
  echo "Keeping plan ID: $KEEP_ID"
  
  # Get IDs of plans to delete (all except the first)
  DELETE_IDS=$(echo $PLANS_OF_TYPE | jq -r '.[1:] | map(.id) | .[]')
  
  # Delete duplicates
  for DELETE_ID in $DELETE_IDS; do
    if [ ! -z "$DELETE_ID" ]; then
      echo "Deleting duplicate plan ID: $DELETE_ID"
      curl -s -X DELETE $BASE_URL/api/subscription-plans/$DELETE_ID
    fi
  done
done

echo -e "\n${GREEN}✅ Cleanup complete!${NC}"

# Show final count
FINAL_PLANS=$(curl -s $BASE_URL/api/subscription-plans)
FINAL_COUNT=$(echo $FINAL_PLANS | jq '.docs | length')
echo -e "\n${YELLOW}Final subscription plans count: $FINAL_COUNT${NC}"
echo $FINAL_PLANS | jq '.docs | map({id: .id, name: .planName, type: .planType, price: .price})'
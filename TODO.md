# TODO - Not Implemented Features

This file tracks all features and functions that need to be implemented.

## Admin Dashboard Functions

### 1. `getAllCampaigns`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=all-campaigns`  
**Description:**  
Admin function to view all campaigns in the system regardless of status (active, completed, rejected, pending, etc.)

**Requirements:**
- Query all campaigns from `ad-campaigns` collection
- Support filtering by status, date range, campaign type
- Support pagination (page, limit)
- Support sorting (by date, budget, status)
- Return campaign details including:
  - Campaign name, description, type
  - Budget and budget spent
  - Start/end dates
  - Status and approval status
  - Business/advertiser information
  - Created/updated timestamps

**Related Functions:**
- `getPendingCampaigns` (✅ Already implemented - only returns pending campaigns)

---

### 2. `getPendingApprovals`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=pending-approvals`  
**Description:**  
Unified view of all pending approval items across the system (campaigns, withdrawals, bank details, etc.)

**Requirements:**
- Aggregate pending items from multiple collections:
  - Pending campaigns (`ad-campaigns` where status = 'pending')
  - Pending withdrawals (`driver-withdrawals` where status = 'pending')
  - Pending bank details (`user-bank-details` where status = 'pending')
- Return unified list with item type, details, and timestamps
- Support filtering and sorting
- Group by type or return flat list

**Related Functions:**
- `getPendingCampaigns` (✅ Already implemented)
- `getPendingWithdrawals` (✅ Already implemented)
- `getPendingBankRequests` (✅ Already implemented)

---

### 3. `getRecentActivity`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=recent-activity`  
**Description:**  
Retrieve recent system activity logs for admin dashboard

**Requirements:**
- Query `notification-logs` collection for recent activity
- Support date range filtering (default: last 7 days)
- Support filtering by activity type/channel
- Return activity timeline with:
  - Activity type/description
  - User/entity involved
  - Timestamp
  - Status/outcome
- Support pagination

**Related Collections:**
- `notification-logs` (✅ Collection exists)

---

### 4. `getUserStats`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=user-stats`  
**Description:**  
Aggregated user statistics for admin dashboard

**Requirements:**
- Count users by role (admin, driver, advertiser, partner)
- Count users by status (active, inactive, verified, unverified)
- User growth metrics (new users per period)
- User engagement metrics
- Geographic distribution (if available)
- Return time-series data for trends

**Related Functions:**
- `getAllUsers` (✅ Already implemented - returns user list, not stats)
- `getAdminStats` (✅ Already implemented - basic stats, might overlap)

---

### 5. `getCampaignStats`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=campaign-stats`  
**Description:**  
Detailed campaign performance statistics and analytics

**Requirements:**
- Campaign performance metrics:
  - Total campaigns by status
  - Total budget vs budget spent
  - Campaign completion rates
  - Average campaign duration
- Performance by campaign type (magazine, digital, QR engagement)
- Top performing campaigns
- Campaign ROI metrics
- Time-series data for trends
- Support date range filtering

**Related Functions:**
- `getSystemAnalytics` (✅ Already implemented - includes basic campaign counts)
- `getPendingCampaigns` (✅ Already implemented)

---

### 6. `getFinancialStats`
**Status:** ❌ Not Implemented  
**Location:** `src/endpoints/adminDashboardEndpoints.ts`  
**Route:** `GET /api/admin/dashboard?action=financial-stats`  
**Description:**  
Dedicated financial reporting and statistics for admin dashboard

**Requirements:**
- Revenue metrics:
  - Total revenue
  - Revenue by period (daily, weekly, monthly)
  - Revenue by source
- Earnings statistics:
  - Total earnings
  - Paid vs pending earnings
  - Earnings by user type
- Withdrawal statistics:
  - Total withdrawals
  - Pending withdrawals amount
  - Withdrawal trends
- Budget and spending:
  - Total campaign budgets
  - Budget spent vs allocated
  - Budget by campaign type
- Support date range filtering
- Return time-series data for trends

**Related Functions:**
- `getSystemAnalytics` (✅ Already implemented - includes financial data but not as dedicated function)

---

## Implementation Priority

1. **High Priority:**
   - `getAllCampaigns` - Core admin functionality
   - `getPendingApprovals` - Unified view for admin workflow

2. **Medium Priority:**
   - `getCampaignStats` - Important for campaign management
   - `getFinancialStats` - Important for financial reporting

3. **Lower Priority:**
   - `getRecentActivity` - Nice to have for monitoring
   - `getUserStats` - Can use existing `getAdminStats` for now

---

## Notes

- All functions should follow the existing pattern in `adminDashboardEndpoints.ts`
- All functions should use `checkAdminAccess(req.user)` for authorization
- All functions should return `Response` objects with proper JSON formatting
- All functions should handle errors gracefully with try-catch blocks
- Consider adding pagination, filtering, and sorting to all list functions
- Consider caching for frequently accessed statistics

---

## Last Updated
2024-12-19 - Initial TODO list created after fixing auth API calls


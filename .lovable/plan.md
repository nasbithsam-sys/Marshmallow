

# Fix Plan: Missing Columns, Auth, Permissions, and Notifications

## Issues Found

### 1. Missing columns in `leads` table (causes "Failed to create lead")
The code inserts 12 columns that don't exist in the database:
`number_name`, `quote`, `service_details`, `customer_schedule_requirements`, `reference_name`, `tech_name`, `tech_number`, `terms`, `labor_amount`, `material_amount`, `for_you_amount`, `for_us_amount`

**Fix**: Add all 12 columns via migration.

### 2. Edge function bug breaks access code verification (OTP not working)
In `supabase/functions/admin-users/index.ts`, the `verify_access_code` and `check_access_code` actions reference `adminClient` (lines 59, 73, 95, 105) before it is declared (line 122). This causes a ReferenceError, so:
- The access code check silently fails (caught by `try/catch` on login page line 63)
- Users log in without ever being prompted for an access code

**Fix**: Move `adminClient` creation to the top of the handler, before any action processing.

### 3. Navigation permissions completely broken (admin-granted tab access not showing)
`AuthContext.canAccess()` checks `p.role === role && p.nav_item === navItem` but the `navigation_permissions` table has columns `user_id` and `nav_section` -- not `role` or `nav_item`. The query also fetches ALL permissions without filtering by user.

**Fix**: Update `AuthContext` to:
- Query `navigation_permissions` filtered by `user_id`
- Match on `p.nav_section === navItem` instead of non-existent fields

### 4. Notifications RLS blocks cross-user notifications (shared lead notifications fail)
The `notifications` table has an ALL policy: `auth.uid() = user_id`. This means a user can only insert notifications for themselves. When an admin shares a lead and tries to insert a notification for a CS user, RLS blocks it.

**Fix**: Add a separate INSERT policy allowing authenticated users to insert notifications for any user (the notification is for the recipient, not the sender). Keep the SELECT/UPDATE/DELETE restricted to own notifications.

### 5. Missing `lead_payments` table
The edge function's `delete_lead` action tries to delete from `lead_payments`, but this table doesn't exist.

**Fix**: Create `lead_payments` table with appropriate columns and RLS.

## Implementation Steps

### Step 1: Database migration
Single migration adding:
- 12 missing columns to `leads` table
- `lead_payments` table (id, lead_id, amount, screenshot_url, created_at, created_by)
- Fix notifications RLS: drop the ALL policy, create separate SELECT (own), INSERT (authenticated), UPDATE (own), DELETE (own) policies

### Step 2: Fix edge function
Move `adminClient` creation to before the action routing so `verify_access_code` and `check_access_code` can use it.

### Step 3: Fix AuthContext `canAccess`
- Filter `navigation_permissions` query by `user_id`
- Fix `canAccess` to check `p.nav_section === navItem` and `p.user_id === user.id`




## Plan: Admin-Only Access Codes for Non-Admin Users

### What
Add a one-time access code system where admins can generate and view login codes for non-admin users directly in the Settings > Users tab. Only admins see these codes. Codes regenerate after each use (login).

### Database Changes
1. **New table `user_access_codes`**:
   - `id` (uuid, PK)
   - `user_id` (uuid, FK to auth.users, unique)
   - `code` (text, 6-digit random code)
   - `created_at` (timestamptz)
   - RLS: only admins can SELECT/UPDATE (using `has_role` function)

### Frontend Changes

1. **`src/pages/Settings.tsx`** — In the Users tab, for each non-admin user card:
   - Add a "Generate Code" button (or show current code) visible only to admins
   - Display the 6-digit code in a monospace font with a copy button
   - Add a "Regenerate" button to create a new code on demand
   - Fetch codes from `user_access_codes` table alongside user data

2. **`src/pages/Login.tsx`** — Add an optional "Access Code" field:
   - After successful email/password login, if user is non-admin and has an access code entry, prompt for the code
   - Validate code against `user_access_codes` table
   - On successful verification, regenerate the code (so it's single-use)
   - Admins skip this step entirely (they use TOTP)

3. **Code generation logic** — Simple random 6-digit numeric code generated client-side by the admin, stored in Supabase. After each successful use, a new code is generated and stored.

### Files to edit
- **`src/pages/Settings.tsx`** — Add code display/generate UI per non-admin user
- **`src/pages/Login.tsx`** — Add access code verification step after password login for non-admin users
- **Database migration** — Create `user_access_codes` table with RLS


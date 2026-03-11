
Do I know what the issue is? Yes.

## Root causes found in current code

1. **Admin delete shows success but does nothing**
- `src/components/leads/LeadCard.tsx`: lead delete treats “no error” as success.
- With Supabase RLS, a blocked delete can return **0 affected rows with no error**, so UI says “Lead deleted” even when row remains.
- `src/pages/Settings.tsx`: user delete uses `Promise.all(...)` but ignores each delete result and always toasts success. It also only deletes app tables, not the actual `auth.users` account.

2. **User creation fails with “email rate limit exceeded” + “email not confirmed”**
- `src/pages/Settings.tsx` uses `supabase.auth.signUp(...)` from client.
- This triggers confirmation-email flow (and rate limits), which is exactly what you said you do not want.

3. **Password change currently email-based**
- `src/pages/Settings.tsx` uses `resetPasswordForEmail`, which depends on sending email; you requested admin direct password change without email.

4. **OTP model mismatch**
- Admin TOTP exists (`MFAEnroll`), non-admin uses admin-managed `user_access_codes`.
- Flow exists, but user lifecycle (create/delete/password) is not implemented with secure admin backend methods.

## Implementation plan

### 1) Move admin user management to secure server-side actions (no email dependency)
- Add an admin-only backend endpoint (Supabase Edge Function) for:
  - `create_user` (uses `auth.admin.createUser({ email, password, email_confirm: true })`)
  - `set_password` (uses `auth.admin.updateUserById`)
  - `delete_user` (uses `auth.admin.deleteUser`)
  - `rotate_access_code` / `set_access_code`
- Enforce admin check inside function using `user_roles` + `has_role(...)`.

### 2) Fix deletion reliability (lead + user)
- **Lead delete** (`LeadCard.tsx`):
  - Require affected-row verification (`delete().eq(...).select('id')`).
  - If zero rows deleted, show permission/RLS error (no success toast).
  - Optional: centralize lead delete in backend function to guarantee child cleanup + permission checks in one place.
- **User delete** (`Settings.tsx`):
  - Replace client-side table-only deletion with backend `delete_user` action.
  - Only show success when auth user deletion actually succeeded.

### 3) Replace email-based user actions in Settings
- In `src/pages/Settings.tsx`:
  - Replace `signUp` with backend `create_user`.
  - Remove/reset “Reset via email” flow.
  - Add “Change Password” action (admin enters new password directly).
  - Keep/create non-admin access code display + regenerate for admin only.

### 4) Lock in auth behavior to your exact requirement
- Admin: keep TOTP authenticator (existing MFA screen).
- Non-admin: keep admin-managed code in Users section only (not visible to users).
- On non-admin successful code verification, keep rotating code per use.

### 5) RLS + policy corrections (SQL)
- Ensure admin delete/update policies exist on:
  - `leads`, `lead_notes`, `lead_photos`, `lead_shares`, `lead_updates`, `notifications`, `lead_payments`, `profiles`, `user_roles`, `user_access_codes`.
- Ensure `user_access_codes` policies:
  - Admin can read/manage all.
  - Non-admin can only read/update own row for login verification path (if needed).
- Ensure delete policies are explicit for `authenticated` with admin role checks.

## Technical details

- Main frontend files to update:
  - `src/pages/Settings.tsx`
  - `src/components/leads/LeadCard.tsx`
  - `src/pages/Login.tsx` (only if tightening code-verification enforcement)
  - `src/lib/admin-api.ts` (new helper for function calls)
- Backend additions:
  - New Supabase Edge Function for admin user management
  - SQL policy script for delete/update access consistency

## Validation checklist after implementation

1. Admin deletes a lead → lead disappears immediately and stays deleted after refresh.
2. Admin deletes user → user removed from settings and cannot log in.
3. Admin creates user with any email (not pre-verified) → succeeds, no confirmation email required.
4. Admin changes any user password directly in Users tab without email.
5. Admin sees non-admin codes; non-admin users do not.
6. Admin TOTP login still works; non-admin code flow still works.

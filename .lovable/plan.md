

## Plan: Admin-Visible One-Time Codes for Non-Admin Users

### What
Add a system where non-admin users see a one-time login code (instead of TOTP enrollment). Admins can view these codes in the user management section. Each code is single-use and regenerates after being consumed.

### Why not TOTP-based
TOTP requires the user to have an authenticator app. Instead, this would be a simpler invite/access code system managed by the admin.

### However -- important clarification needed

Supabase Auth doesn't natively support custom one-time codes outside of its built-in OTP (email/SMS). A custom implementation would need:
- A `user_access_codes` table storing hashed codes per user
- A custom login flow that validates the code before or after email/password
- Code rotation logic (regenerate after use)

This is a significant feature. Before proceeding, I need to clarify the exact use case.

### Questions
1. Is this for **initial login** (user gets a code instead of password)?
2. Or is this a **secondary verification** step after password login?
3. Should the code be shown to the user too, or only visible to admins?
4. What triggers code regeneration -- every login, or admin manually?


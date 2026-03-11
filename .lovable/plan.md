

## Problem

The edge function `admin-users` uses `callerClient.auth.getClaims(token)` which **does not exist** in the Supabase JS client v2. Every call to the edge function fails with a 401 "Unauthorized" response, which is why:
- Admin can't delete users or leads (gets error silently or shows success but nothing happens)
- Admin can't create users
- Admin can't change passwords

The frontend catches the error but the toast may show briefly or be missed.

## Fix

### 1. Fix edge function auth verification (`supabase/functions/admin-users/index.ts`)

Replace the broken `getClaims` approach with `auth.getUser(token)` which is the standard method:

```typescript
// REPLACE:
const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const callerId = claimsData.claims.sub;

// WITH:
const { data: { user: callerUser }, error: userError } = await adminClient.auth.getUser(token);
if (userError || !callerUser) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const callerId = callerUser.id;
```

Key change: Use the `adminClient` (service role) to call `auth.getUser(token)` to verify the JWT and extract the user ID. This is reliable and works with all versions of the Supabase client.

Also remove the unused `callerClient` since we no longer need a separate client just for auth verification.

### 2. No frontend changes needed

`src/pages/Settings.tsx` and `src/components/leads/LeadCard.tsx` already correctly use `adminApi.*` methods. Once the edge function auth is fixed, all operations (create user, delete user, delete lead, set password) will work.

### Files to modify
- `supabase/functions/admin-users/index.ts` -- fix auth verification method


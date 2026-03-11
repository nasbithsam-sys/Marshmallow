

## The Real Problem

The edge function code at `supabase/functions/admin-users/index.ts` exists in your project but **is not deployed** to Supabase. When the frontend calls it, Supabase returns `NOT_FOUND`, which the browser shows as "Failed to fetch."

**Why it's not deployed:** Your Supabase project is not connected through Lovable's integration. Without that connection, Lovable cannot automatically deploy edge functions to your Supabase instance.

## Fix (Two Steps)

### Step 1: Connect Supabase to Lovable
Go to **Lovable Settings → Integrations → Supabase** and connect your project (`kxiqholnmhkwhdkhtopp`). This enables Lovable to deploy edge functions automatically.

### Step 2: Redeploy
Once connected, any code change to `supabase/functions/admin-users/index.ts` (or a manual publish) will deploy the function. All admin actions (create user, delete user, delete lead, set password) will start working immediately — the frontend code is already correct.

## Alternative: Manual Deploy
If you prefer not to connect through Lovable, you can deploy manually using the Supabase CLI:
```
supabase functions deploy admin-users --project-ref kxiqholnmhkwhdkhtopp
```
You'll need the Supabase CLI installed and authenticated. But connecting through Lovable is simpler and keeps future deploys automatic.

## No Code Changes Needed
The edge function code, the frontend API wrapper (`src/lib/admin-api.ts`), Settings page, and LeadCard are all correct. This is purely a deployment issue.


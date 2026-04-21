

## Goal

Get Lovable to pick up the freshly re-authorized Lovable app in your **Acc Boosters** Supabase org so database migrations and queries work again. Once that's done, run the queued security migration.

## Why it's still failing

- Supabase side: ✅ Lovable is authorized in Acc Boosters (confirmed in your screenshot, 21/04/2026 19:07).
- Lovable side: ❌ Still holding the old expired OAuth token. Test query just returned `SUPABASE_UNAUTHORIZED — Your Supabase authentication has expired`.

Revoking + re-authorizing on Supabase generated a **new** grant, but Lovable's cached token is from the **old** grant. Lovable has to redo its own OAuth flow to swap the token.

## Steps for you (in order, stop when it works)

1. **Hard refresh Lovable** — `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac). Sometimes a stale browser cache is the only thing standing in the way.

2. **Trigger Lovable's reconnect flow:**
   - Open the **Cloud view** (☁ icon, top toolbar).
   - Click **"Manage organizations"** (the button referenced in your current view).
   - In the dialog, click **"Add More Organizations"** or **"Reconnect"**.
   - Supabase will open in a new tab — pick **Acc Boosters** → **Authorize**.
   - Return to Lovable; the orange banner should disappear.

3. **If "Manage organizations" still shows Acc Boosters as missing** — fully sign out and back in:
   - Lovable: profile menu (top-right) → **Log out**.
   - Log back in.
   - Open the project → Cloud view → the org list should now include Acc Boosters.

4. **Reply "done"** once the orange "Supabase connection issue" banner is gone.

## What I'll do once you reply "done"

1. Re-run `SELECT 1` to confirm Lovable's token is fresh.
2. Apply the queued security migration:
   - **profiles** — restrict the public-readable email column (currently every authenticated user can read all emails).
   - **activity_logs** — lock SELECT to admins only.
   - **lead-photos bucket** — tighten storage policies so only the lead's owner / shared users / admins can read.
3. Re-run the security scanner and report the resulting findings list.

## If step 2 still fails

The fallback is account-level: in Lovable open **Account Settings → Integrations → Supabase → Disconnect**, then reconnect. That nukes any cached token completely. I'll only suggest this if steps 1–3 above don't clear the banner, since it requires re-picking every org.


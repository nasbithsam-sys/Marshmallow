
Goal: fix the “Failed to fetch” loop in one pass for all admin actions (create user, delete user, delete lead, set password, access code ops).

1) Root cause confirmed
- `https://kxiqholnmhkwhdkhtopp.supabase.co/functions/v1/admin-users` currently returns `{"code":"NOT_FOUND","message":"Requested function was not found"}`.
- So frontend calls in `src/lib/admin-api.ts` are hitting a missing backend endpoint.
- Current client uses raw `fetch` to the function URL, which causes opaque browser errors (`Failed to fetch`) when gateway/CORS/function availability fails.

2) One-go backend reliability fix
- Ensure Supabase is properly connected in Lovable (Integrations → Supabase) so edge function deployment is active.
- Redeploy/create `admin-users` function from `supabase/functions/admin-users/index.ts`.
- Keep strict role authorization in-code (`adminClient.auth.getUser(token)` + `user_roles` check).
- Add explicit `ping` action to confirm function health from UI.
- Strengthen function responses: always JSON + CORS + clear error codes (`UNAUTHORIZED`, `NOT_ADMIN`, `CONFIG_MISSING`, `ACTION_FAILED`).
- Validate required env (`SB_SERVICE_ROLE_KEY`) at runtime and fail with explicit message if missing.
- Security: rotate the leaked service-role key and update `SB_SERVICE_ROLE_KEY`.

3) One-go frontend fix (remove fetch fragility)
- Refactor `src/lib/admin-api.ts` to use `supabase.functions.invoke('admin-users', { body })` instead of manual URL fetch.
- Add normalized error parser for:
  - function missing/not deployed
  - auth/session expired
  - permission denied
  - backend action failures
- Return user-friendly errors (no generic “Failed to fetch”).

4) Settings + Leads hardening
- `src/pages/Settings.tsx`
  - Route all privileged actions through `adminApi` only (create user, delete user, set password, code generate/rotate if needed).
  - Add loading/disabled states and retry-safe UX.
  - Show backend health banner if `ping` fails (“Admin backend not deployed/configured”).
- `src/components/leads/LeadCard.tsx`
  - Keep delete through `adminApi.deleteLead`.
  - Surface specific backend errors in toast.

5) Config cleanup
- `supabase/config.toml`
  - Keep function JWT strategy consistent with deployment mode (for standard Supabase, prefer gateway JWT verification; keep in-code admin role authorization regardless).
- Remove unused vars in function and add structured logs for each action path.

Technical file scope
- `supabase/functions/admin-users/index.ts`
- `supabase/config.toml`
- `src/lib/admin-api.ts`
- `src/pages/Settings.tsx`
- `src/components/leads/LeadCard.tsx`

Validation checklist (must all pass)
1. Health check (`ping`) succeeds from Settings.
2. Create user works without email confirmation/rate-limit flow.
3. Set password works instantly (no email reset).
4. Delete user removes app data and auth account.
5. Delete lead removes lead + related records.
6. Non-admin code generation/regeneration works from admin panel.
7. No action shows raw “Failed to fetch”; all errors are actionable.
8. End-to-end verify on Preview after deployment, then Publish and re-test on Live.

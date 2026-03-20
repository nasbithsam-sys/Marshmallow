

# Comprehensive Bug & Issue Audit

## Critical Bugs

### 1. Notification INSERT fails for other users (RLS violation)
**Severity: HIGH** — Notifications are silently never delivered.

The RLS policy on `notifications` requires `user_id = auth.uid()`. But when CS/processor changes status to "urgent_job" or "need_tech", the code inserts notifications for **other users** (admins, processors). These inserts are silently rejected by RLS.

Affected code:
- `LeadCard.tsx` line 177-184 — status change notifications
- `LeadDetailPanel.tsx` line 359-366 — same
- `LeadDetailPage.tsx` line 41-49 — `sendNotifications`
- `AddLeadDialog.tsx` line 53-61 — `sendNotifications`
- `LeadShareDialog.tsx` line 68 — share notification

**Fix**: Create a new edge function `send-notifications` that uses the service role to insert notifications for other users, or change the RLS policy to allow inserts where the inserter has a valid session (e.g. `auth.uid() IS NOT NULL`) instead of restricting to own `user_id`.

### 2. LeadDetailPanel still has separate city/state/zip fields
**Severity: MEDIUM** — Inconsistent with AddLeadDialog and the previous plan to use a single address field.

`LeadDetailPanel.tsx` lines 652-694 still shows Street, City, State, Zip as separate fields. This was supposed to be consolidated into a single Address field per the previous plan.

**Fix**: Remove the separate City/State/Zip fields from `LeadDetailPanel.tsx`, keep only the Address field.

### 3. `last_edited_at` vs `updated_at` inconsistency
**Severity: MEDIUM** — Different timestamps used across the app.

- `LeadDetailPanel.tsx` uses `last_edited_at` for the "last edited" display and sets `last_edited_at` in save.
- `LeadCard.tsx` uses `updated_at` for the "last edited" display but only sets `updated_at` (not `last_edited_at`).
- `LeadDetailPage.tsx` sets `updated_at` but reads `updated_at` for display.
- The DB has both `last_edited_at` and `updated_at` columns.

This means `last_edited_at` is only set by `LeadDetailPanel`, while other views set `updated_at` but never `last_edited_at`, causing stale/missing timestamps in the AllLeads table view (which reads `last_edited_at`).

**Fix**: Standardize all save operations to set both `last_edited_at` and `updated_at`.

### 4. Memory leak: `URL.createObjectURL` never revoked
**Severity: LOW** — `LeadDetailPage.tsx` line 587 creates object URLs for new photos in `allImageUrls` but never calls `URL.revokeObjectURL`.

**Fix**: Clean up object URLs in a `useEffect` return or when `newPhotos` changes.

## Logic Issues

### 5. CS can see processor notes in LeadDetailPanel
**Severity: MEDIUM** — Violates the note segregation rule (CS cannot view Processor notes).

`LeadDetailPanel.tsx` shows processor notes section without role-gating. The processor section (tech_name, tech_number, terms, financial fields, processor_notes) is visible to CS users — it only uses `readOnly={isProcessor}` for some fields but doesn't hide the processor section from CS.

**Fix**: Wrap the processor section in `{!isCS && (...)}` in LeadDetailPanel, same as LeadDetailPage does (line 831: `{!isCS && (...)}`).

### 6. Export only exports filtered/visible leads, not ALL leads
**Severity: LOW** — The export in `LeadsPage.tsx` exports `filtered` (the current search/status-filtered list), not all leads. For admin wanting to export everything, they must clear filters first. Also, `general_notes` field is missing from export.

**Fix**: Add `general_notes` to export data. Optionally add an "Export All" option.

### 7. Processor can still see "Edit Lead" button and edit page
**Severity: LOW** — Processors navigate to `/leads/:id` (full edit page) where many fields are `readOnly` but the page is still accessible. They can also edit `general_notes`, `processor_notes`, photos, schedule, and status — this seems intentional. No real bug, but worth noting.

### 8. `no_role` still in `roleColors` in Settings.tsx
**Severity: LOW** — Line 55 still has `no_role` in the `roleColors` map. Plan said to remove it but it remains. Not breaking but inconsistent.

**Fix**: Remove line 55 (`no_role` entry).

## Security Issues

### 9. Leaked password protection disabled
**Severity: WARN** — Supabase setting, requires manual enable in dashboard.

### 10. `access_code_client_only` (known)
Already documented as architectural limitation.

## Proposed Fix Summary

| # | File(s) | Fix |
|---|---------|-----|
| 1 | DB migration + multiple files | Change notifications INSERT RLS to `auth.uid() IS NOT NULL`, OR create edge function for cross-user notifications |
| 2 | `LeadDetailPanel.tsx` | Remove City/State/Zip separate fields |
| 3 | `LeadCard.tsx`, `LeadDetailPage.tsx` | Set both `last_edited_at` and `updated_at` in all update operations |
| 4 | `LeadDetailPage.tsx` | Revoke object URLs on cleanup |
| 5 | `LeadDetailPanel.tsx` | Hide processor section from CS users |
| 6 | `LeadsPage.tsx` | Add `general_notes` to export |
| 8 | `Settings.tsx` | Remove `no_role` from `roleColors` |


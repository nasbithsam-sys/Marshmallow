

# Audit & Fix Plan for Lead CRM

## 1. Status-Permission Filtering Across All Views

**Problem:** There is no status-permission filtering anywhere. The `status_permissions` table exists and Settings page manages it, but no page checks it before displaying leads.

**Fix:** Add a hook `useAllowedStatuses` that fetches the user's `status_permissions` and returns a set of allowed statuses. Then filter leads in:
- `LeadsPage.tsx` — filter `leads` and `sharedLeads` by allowed statuses
- `AllLeads.tsx` — filter leads by allowed statuses  
- `SchedulePage.tsx` — filter scheduled leads by allowed statuses
- `LeadDetailPanel.tsx` — filter status dropdown to only allowed statuses

**Default behavior:** If no status_permissions row exists for a user+status, treat it as **allowed** (matching `getStatusPermission` default of `true` in Settings). Admins bypass all filtering.

## 2. CS Visibility (Own Leads Only)

**Status:** Already working correctly in `LeadsPage.tsx` (line 62-64) and `AllLeads.tsx` (line 37-39). CS users query with `.eq("created_by", user.id)` plus shared leads. No fix needed.

## 3. lead_notes Check Constraint Error

**Problem:** The `lead_notes` table has a CHECK constraint: `note_type IN ('cs', 'processor')`. The code tries to insert `note_type = 'general'` which violates this constraint.

**Fix:** Database migration to alter the constraint to include `'general'`:
```sql
ALTER TABLE public.lead_notes DROP CONSTRAINT lead_notes_note_type_check;
ALTER TABLE public.lead_notes ADD CONSTRAINT lead_notes_note_type_check CHECK (note_type = ANY (ARRAY['cs','processor','general']));
```

## 4. CS Notes & Processor Notes Not Saving/Displaying

**Problem:** The AddLeadDialog saves `cs_notes` and `processor_notes` as columns on the `leads` table (free-text fields). These save correctly to the DB. However, in the LeadDetailPanel, notes are displayed as **NoteThread** chat components (querying `lead_notes` table), not from the `leads.cs_notes`/`leads.processor_notes` columns. The two systems are disconnected.

**Fix:** When creating a lead, if `cs_notes` is filled, also insert into `lead_notes` with `note_type='cs'`. Same for `processor_notes` → `note_type='processor'`. This bridges the creation-time free-text notes into the thread-based notes system used in the detail panel.

## 5. OTP / Access Code Not Actually Enforced

**Problem:** The Login page calls `check_access_code` via edge function after sign-in (line 53). If the user has an access code, it signs them out and shows the access code screen. The edge function code looks correct and `adminClient` is initialized before the actions (line 30). 

**Likely issue:** The `catch` block on line 63 silently swallows errors (`fail open`). If the edge function returns an error or the invocation fails, users bypass access code entirely.

**Fix:**
- Change fail-open to fail-closed: if `check_access_code` call fails, sign the user out and show an error instead of allowing login
- Ensure non-admin users **without** an access code in the DB cannot log in (they need an admin to generate one first), OR allow login if no code exists (current behavior — only enforce if code exists)

## 6. Schedule View Color Mapping

**Problem:** Schedule blocks use `BLOCK_COLORS` array based on employee index, not lead status. All leads get the same gradient colors per employee.

**Fix:** Replace the employee-based color with status-based colors:
- `urgent_job` → red gradient
- `cancelled` → yellow gradient  
- `job_done` → light green gradient
- `paid` → green gradient
- all others → blue gradient (current default)

In `SchedulePage.tsx`, replace `leadBlockColor` assignment (line 320) with a function that maps `lead.status` to the correct color class.

## 7. Add Lead Form Spacing

**Problem:** Excessive `space-y-4` gaps and padding in the form sections.

**Fix:** Reduce `space-y-4` to `space-y-3` on the main form, reduce section padding from `p-4` to `p-3`, and tighten collapsible content spacing. Minimal changes — just tighter vertical rhythm.

## Summary of Changes

| File | Change |
|------|--------|
| New: `src/hooks/useAllowedStatuses.ts` | Hook to fetch status permissions |
| `src/pages/LeadsPage.tsx` | Filter leads by allowed statuses |
| `src/pages/AllLeads.tsx` | Filter leads by allowed statuses |
| `src/pages/SchedulePage.tsx` | Filter leads by allowed statuses + status-based colors |
| `src/pages/Login.tsx` | Change fail-open to fail-closed on access code check |
| `src/components/leads/AddLeadDialog.tsx` | Insert cs/processor notes into lead_notes table on creation + tighten spacing |
| `src/components/leads/LeadDetailPanel.tsx` | Filter status dropdown by allowed statuses |
| Migration | Drop & re-add `lead_notes_note_type_check` to include `'general'` |


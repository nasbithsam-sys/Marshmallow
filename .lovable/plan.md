

# Fix Plan: Multiple UI & Logic Issues

## 1. LeadCard — Show last edited time (not just date)

**File:** `src/components/leads/LeadCard.tsx` (line 339)

Currently: `new Date(lead.updated_at).toLocaleDateString()`
Change to: `new Date(lead.updated_at).toLocaleString()` to include time.

## 2. Activity Logs — Show all users' activity with clear descriptions

**File:** `src/lib/activity.ts`
- The `user_name` is hardcoded to `""`. Fix: look up the user's profile name before inserting, or pass it as a parameter.
- Change `logActivity` to accept `userName` param and store it.

**File:** `src/pages/LeadDetailPage.tsx`
- Pass user's profile name to `logActivity` calls.
- Make details more descriptive: include customer name, old/new status when status changes, specific field changes.

**File:** `src/components/leads/LeadCard.tsx`
- Add `logActivity` call when status is changed from the card's status dropdown (currently no activity log is created for status changes from the card view).

**File:** `src/components/leads/AddLeadDialog.tsx`
- Add `logActivity` call when a lead is created via the dialog.

**File:** `src/pages/ActivityLogs.tsx`
- Already shows all users' logs (no user filter). No change needed to the query. The issue is that `user_name` is empty, so initials show "?" — fixing the logging will fix the display.

## 3. Map Page — Add status filter on top

**File:** `src/pages/MapPage.tsx`
- Add a multi-select or status dropdown filter above the map (alongside the existing search/date filters).
- Filter `dateFiltered` leads by selected statuses before geocoding.
- Keep the legend at the bottom as-is.

## 4. Export — Single dropdown button, admin-only, export ALL lead fields

**File:** `src/pages/LeadsPage.tsx`
- Replace two separate CSV/XLSX buttons with a single "Export" button that opens a dropdown with CSV and XLSX options.
- Already admin-only (wrapped in `{isAdmin && ...}`). No change needed for permissions.
- Expand exported fields to include ALL lead columns: number_name, quote, service_details, customer_schedule_requirements, reference_name, tech_name, tech_number, terms, labor_amount, material_amount, for_you_amount, for_us_amount, cs_notes, processor_notes, general_notes, city, state, zip_code, email, scheduled_time_start, scheduled_time_end, last_edited_by (resolved to name), payment_amount, payment_screenshot_url.

## 5. Edit form should match Add form layout (dialog popup, single address field)

**File:** `src/pages/LeadDetailPage.tsx`
- Remove the separate city/state/zip fields. Keep only the single "Address" input (matching AddLeadDialog).
- The edit form currently renders as a full page. Change it to render inside a `Dialog` (same as AddLeadDialog) so both add and edit are consistent popup modals.
- The form payload already sends `city`, `state`, `zip_code` — keep sending them but don't show separate inputs. Set them to null or keep existing values silently.

## 6. Notes from creation should show on LeadCard

**File:** `src/components/leads/LeadCard.tsx`
- Currently the card shows NoteThread (chat-style threads from `lead_notes` table) inside collapsibles.
- The notes entered during creation are saved to `leads.cs_notes` / `leads.processor_notes` / `leads.general_notes` columns AND also bridged to `lead_notes` table.
- The issue is that the NoteThread queries `lead_notes` table, which should already have the bridged notes. Need to verify the bridging in AddLeadDialog actually works.

**File:** `src/components/leads/AddLeadDialog.tsx`
- Check: After inserting the lead, CS notes and processor notes should be inserted into `lead_notes`. Looking at the code... the bridging code was added in a previous iteration but I don't see it in the current `AddLeadDialog.tsx`. The `handleSubmit` only inserts the lead and photos — no `lead_notes` insert.
- Fix: After successful lead creation, insert notes into `lead_notes` table for cs_notes, processor_notes, and general_notes if they're non-empty.

## Summary of file changes

| File | Changes |
|------|---------|
| `src/components/leads/LeadCard.tsx` | Show time in "last edited", add logActivity for status changes |
| `src/lib/activity.ts` | Accept and store user_name parameter |
| `src/pages/LeadDetailPage.tsx` | Remove city/state/zip separate fields, wrap in Dialog for edit mode, pass user name to logActivity, more descriptive details |
| `src/pages/ActivityLogs.tsx` | No changes needed |
| `src/pages/MapPage.tsx` | Add status filter dropdown above map |
| `src/pages/LeadsPage.tsx` | Single Export dropdown button, export all fields |
| `src/components/leads/AddLeadDialog.tsx` | Bridge notes to lead_notes table after creation, add logActivity |




## Issues & Fixes

### 1. Add Lead opens full page instead of popup
The "New Lead" button navigates to `/leads/new` which renders `LeadDetailPage` as a full-page form. The `AddLeadDialog` component exists as a proper popup dialog but isn't used.

**Fix**: Change LeadsPage to use `AddLeadDialog` instead of navigating to `/leads/new`. Add state `showAddDialog` and render `AddLeadDialog` inline.

### 2. `job_id` NOT NULL error
The `LeadDetailPage.handleSave()` (line 174) inserts without `job_id`. The `AddLeadDialog` has `generateJobId()` but LeadDetailPage doesn't.

**Fix**: Add `generateJobId()` to both:
- `AddLeadDialog` (already has it — confirmed working)
- `LeadDetailPage` insert (add `job_id: generateJobId()` to the insert payload at line 174)

Since we're switching to the dialog for new leads, the primary fix is ensuring `AddLeadDialog` is used. But we should also fix `LeadDetailPage` for safety.

### 3. Address should be a single field, not split
User wants ONE address input — no separate city/state/zip fields.

**Fix in AddLeadDialog**: Remove the city/state/zip row. Keep a single `address` textarea/input. Remove `city`, `state`, `zip_code` from form state. Send address as-is to the `address` column. Send `null` for city/state/zip_code.

### 4. Only name and phone should be mandatory
Currently name is required, phone is optional. User wants only name and number mandatory.

**Fix**: Add `required` to phone input, remove required from other fields (already optional).

### Files to edit

1. **`src/pages/LeadsPage.tsx`** — Replace `navigate("/leads/new")` with dialog state toggle, render `AddLeadDialog`, import it
2. **`src/components/leads/AddLeadDialog.tsx`** — Remove city/state/zip split, single address field, make phone required, ensure `job_id` is in insert
3. **`src/pages/LeadDetailPage.tsx`** — Add `job_id` to insert for safety (line 174)


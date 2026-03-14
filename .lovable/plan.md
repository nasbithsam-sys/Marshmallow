

# Plan: Status Change Permissions & Role Cleanup

## Summary of Changes

### 1. Role-based status change restrictions

Create a utility function `getChangeableStatuses(role)` that returns only the statuses a role can **change a lead to**:

- **CS**: `need_tech`, `urgent_job`, `waiting_customer_response`, `waiting_complete_details`, `quote_sent_waiting`, `quote_sent_need_follow_up`, `needs_quote`, `needs_reschedule`
- **Processor**: `scheduled`, `job_in_progress`, `paid`, `payment_pending`, `job_done`, `needs_reschedule`
- **Admin**: all statuses
- **`cancelled`**: admin only

This is separate from visibility — it only controls which statuses appear in the status-change dropdown.

Apply this filter in:
- `LeadCard.tsx` — status `<Select>` dropdown (line 373, currently shows `ALL_LEAD_STATUSES`)
- `LeadDetailPanel.tsx` — `StatusDropdownFiltered` component (line 38, currently uses `useAllowedStatuses` which is for visibility)
- `LeadDetailPage.tsx` — status dropdown in the edit form
- `AddLeadDialog.tsx` — status dropdown in the create form

### 2. Only CS and Admin can create leads

- `LeadsPage.tsx` line 277: wrap "New Lead" button in `{(isAdmin || isCS) && ...}`
- `AllLeads.tsx` line 80: wrap "Add New Lead" button in `{(role === 'admin' || role === 'customer_service') && ...}`
- Processors will not see the create button

### 3. Remove `no_role` option from Settings UI

- `Settings.tsx` line 290 & 523: remove the `<SelectItem value="no_role">` options from role dropdowns
- Keep `no_role` in the type system as a fallback (used when no role is assigned in DB), but don't let admins assign it
- Remove from `roleColors` map (line 43)

### Files to modify

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `getChangeableStatuses(role)` function |
| `src/components/leads/LeadCard.tsx` | Use `getChangeableStatuses` for status dropdown |
| `src/components/leads/LeadDetailPanel.tsx` | Use `getChangeableStatuses` instead of `useAllowedStatuses` for status dropdown |
| `src/pages/LeadDetailPage.tsx` | Use `getChangeableStatuses` for status dropdown |
| `src/components/leads/AddLeadDialog.tsx` | Use `getChangeableStatuses` for status dropdown |
| `src/pages/LeadsPage.tsx` | Hide "New Lead" button for processors |
| `src/pages/AllLeads.tsx` | Hide "Add New Lead" button for processors |
| `src/pages/Settings.tsx` | Remove `no_role` from role select dropdowns |

No database changes needed — this is purely frontend logic controlling which options appear in dropdowns and which buttons are visible.



# Lead Management CRM — Implementation Plan

## Backend Setup (Supabase / Lovable Cloud)

### Database
- **profiles** table — user display name, linked to auth.users
- **user_roles** table — enum roles: `admin`, `processor`, `customer_service`, `no_role`
- **navigation_permissions** table — Admin controls which roles/users can access which nav sections (Activity Logs, Analytics, etc.)
- **leads** table — all lead data: job_id (auto-generated alphanumeric), status, customer info, service details, address, date/time, amount, created_by, assigned_cs, timestamps
- **lead_updates** table — timestamped comment log entries (the "Updated Details" feed), linked to lead + author, with author role tracked
- **lead_drafts** table — auto-saved drafts per user per lead (for the auto-save feature)
- **activity_logs** table — tracks all changes: who changed what, when, on which lead

### Authentication & Roles
- Admin creates accounts for team members (invite flow)
- Role-based access enforced via RLS policies and the `has_role()` security definer function
- CS users can only see leads they created; Processor/Admin see all leads

---

## Navigation (Left Sidebar — fixed 240px)

1. **All Leads** — main workspace
2. **Analytics** — date range picker + single-color bar/line chart of leads per day
3. **Settings** — Admin only: manage users, assign roles, control nav permissions per user
4. **Activity Logs** — Admin + permitted users: chronological log of all changes

No Technicians tab. No hamburger menu. All nav items have text labels.

---

## All Leads View

- Table with columns: Job ID, Customer Name, Status, Last Edit (name + date/time), Created By, key details
- **Sorting**: Urgent Jobs pinned to top, Cancelled leads sink to bottom, newest leads appear first otherwise
- **15 statuses** with color-coded tags using the design system (red=urgent, blue=in-progress, green=done, amber=waiting)
- Clicking a lead opens a **detail panel sliding in from the right (60%)**, list stays visible but dimmed
- "Add New Lead" button always visible with text label

---

## Lead Detail Panel

### Two sections based on role:
- **CS Section**: Customer details, service info, address, date/time, amount, CS Notes — editable by CS, read-only for Processor
- **Processor Section**: Processor Notes, internal details — visible/editable only by Processor & Admin, hidden from CS entirely

### Updated Details Feed
- Non-collapsible chronological log (newest on top)
- Each entry shows: author name, role, date/time, and the note text
- **Signature moment**: new updates render character-by-character (teletype animation) before settling
- Simple text box to add updates, available to both CS and Processor

### Auto-Save
- Draft saves automatically as user types, stored per-user per-lead
- Restored when returning to an incomplete entry

---

## Schedule / Calendar View

- Leads with "Scheduled" status show a calendar icon in the table
- Clicking opens a **modal** with toggleable **daily or weekly** timeline view
- Daily: vertical timeline 7AM–7PM with 2-3 hour job windows blocked out
- Weekly: 7-day grid with the same time slots
- Synced with lead schedule data in the CRM

---

## Analytics Page

- Date range picker to filter
- Total leads count for the selected range
- Single-color (`#1E2024`) bar or line chart showing leads per day on paper-white background
- Monochrome, no chartjunk

---

## Settings (Admin Only)

- **User Management**: Create new users, assign roles, deactivate accounts
- **Navigation Permissions**: Toggle which users/roles can access Activity Logs, Analytics, etc.
- Per-user granular control (e.g., allow a specific Processor to see Activity Logs)

---

## Import / Export (Admin Only)

- **Export**: Download leads for a date range as Excel (.xlsx), using standard lead columns
- **Import**: Upload Excel with a custom template mapping; Admin uploads file, system maps columns, previews data, then imports

---

## Design System

- **Fonts**: Roboto Flex (headlines/UI), Roboto Mono (data/body)
- **Colors**: Paper White `#F9F9F7` background, Ink Black `#1E2024` text, status colors as specified
- **No shadows, no icon-only buttons, no hamburger menus**
- Crisp borders with `#DCDCDC`, disabled elements at 40% opacity
- Generous spacing in table rows (16px/24px padding)

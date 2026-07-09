// Structured content for the CRM documentation.
// Rendered on-screen and exported to PDF from the Settings > Documentation tab.

export type DocBlock =
  | { type: "p"; text: string; italic?: boolean }
  | { type: "bullet"; text: string }
  | { type: "kv"; label: string; value: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export const DOC_TITLE = "Account Boosters CRM";
export const DOC_SUBTITLE = "Complete System Documentation";
export const DOC_VERSION = "Version 1.0 · July 2026";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    blocks: [
      { type: "p", text: "Account Boosters CRM is a lead management system for a home-services operation. It tracks a lead from first contact through quote, scheduling, job execution, and payment. The app is a React 18 + Vite 5 + Tailwind SPA on top of Supabase (Postgres, RLS, Storage, Edge Functions, Realtime)." },
      { type: "p", text: "The system is opinionated: statuses, tags, and role permissions are enforced both in UI and at the database layer. Every mutation writes an audit trail, and both updated_at and last_edited_at are always synchronised." },
    ],
  },
  {
    id: "roles",
    title: "2. User Roles & Permissions",
    blocks: [
      { type: "p", text: "Five roles exist. Roles live in a dedicated user_roles table (never on the profile) and are checked via the SECURITY DEFINER function public.has_role() to avoid RLS recursion." },
      {
        type: "table",
        headers: ["Role", "Purpose", "Can create leads", "Default nav"],
        rows: [
          ["admin", "Full system control, approvals, reviews.", "Yes", "All pages"],
          ["customer_service (CS)", "First contact, quoting, follow-up with customer.", "Yes", "Leads, Schedule"],
          ["processor", "Backend processing, tech assignment, payment.", "No", "Leads, Schedule, Cancellation Requests"],
          ["opr", "Operator with a strictly narrow view.", "No", "Leads only (urgent_job + partial_paid)"],
        ],
      },
      { type: "p", italic: true, text: "Only Admin and CS can create leads. Admins can grant additional pages per user via navigation_permissions." },
      { type: "p", text: "Sidebar visibility is computed from the role default plus per-user overrides in navigation_permissions. Admin bypasses all checks. quo_monitor is admin-only; payment_requests is admin-only." },
    ],
  },
  {
    id: "statuses",
    title: "3. Lead Statuses (Complete Reference)",
    blocks: [
      { type: "p", text: "Twenty statuses exist. Each has a semantic color token and a stable machine key. \"Paid\" is strictly locked once set and cannot be modified again." },
      {
        type: "table",
        headers: ["Key", "Label", "Color", "Meaning"],
        rows: [
          ["waiting_complete_details", "Waiting Complete Details", "Amber", "Lead created; details missing from CX."],
          ["urgent_job", "Urgent Job", "Red", "High-priority; sorts to the top; triggers Urgent notifications."],
          ["quote_sent_waiting", "Quote Sent - Waiting", "Blue", "Quote delivered to CX; awaiting reply."],
          ["post_visit_quote_sent_waiting", "Post Visit-Quote Sent-Waiting", "Slate", "Tech visited, quote sent, waiting on CX."],
          ["activate_customer", "Activate Customer", "Emerald", "CX ready to activate; move toward scheduling."],
          ["quote_sent_need_follow_up", "Quote Sent - Need Follow Up", "Orange", "CX has not responded; CS follow-up needed."],
          ["needs_quote", "Needs Quote", "Purple", "Tech pricing pending; ready for quote build."],
          ["tech_making_quote", "Tech Making Quote", "Violet", "Technician actively preparing the quote."],
          ["waiting_customer_response", "Waiting Customer Response", "Yellow", "Awaiting any information from CX."],
          ["need_tech", "Need Tech", "Indigo", "Assignment needed; triggers Need Tech alerts."],
          ["scheduled", "Scheduled", "Cyan", "Appointment booked with date/time window."],
          ["job_in_progress", "Job in Progress", "Sky", "Tech on-site performing the job."],
          ["needs_reschedule", "Needs Reschedule", "Rose", "Appointment fell through; reschedule required."],
          ["job_done", "Job Done", "Emerald", "Work complete; ready for payment."],
          ["payment_pending", "Payment Pending", "Lime", "Awaiting payment from CX."],
          ["cancellation_requested", "Cancellation Pending", "Amber", "Cancellation request submitted; Admin review."],
          ["cancelled", "Cancelled", "Grey", "Terminal cancelled state."],
          ["paid", "Paid", "Green", "Locked; cannot be modified again once set."],
          ["partial_paid", "Partial Paid", "Emerald", "Partial payment received; balance outstanding."],
          ["payment_requested", "Paid Approval Pending", "Green (pulse)", "Processor requested Paid; awaiting Admin approval."],
        ],
      },
      { type: "p", text: "Who can set which status (STATUS_CHANGE_ACCESS in src/lib/constants.ts):" },
      { type: "kv", label: "Admin", value: "Every status except cancellation_requested and payment_requested (those are workflow outcomes only)." },
      { type: "kv", label: "CS", value: "need_tech, urgent_job, waiting_customer_response, waiting_complete_details, quote_sent_waiting, quote_sent_need_follow_up, needs_quote, needs_reschedule, cancelled, partial_paid." },
      { type: "kv", label: "Processor", value: "post_visit_quote_sent_waiting, activate_customer, tech_making_quote, waiting_customer_response, scheduled, urgent_job, job_in_progress, paid, payment_pending, job_done, needs_reschedule, cancelled, partial_paid." },
      { type: "kv", label: "OPR", value: "partial_paid only." },
      { type: "p", text: "Priority sorting on LeadCard lists:" },
      { type: "bullet", text: "CS-tagged leads win first: ready_to_schedule → confirmation_sent → waiting_schedule_confirmation → booked." },
      { type: "bullet", text: "Then urgent_job (rank 1), need_tech (rank 2)." },
      { type: "bullet", text: "Then everything else by created_at descending." },
      { type: "bullet", text: "cancelled is pushed to the very bottom." },
    ],
  },
  {
    id: "tags",
    title: "4. CS Tags",
    blocks: [
      { type: "p", text: "CS tags are a secondary axis on top of status, used to surface a lead's scheduling state without changing the main status." },
      {
        type: "table",
        headers: ["Tag key", "Label", "Assignable by"],
        rows: [
          ["ready_to_schedule", "Ready to schedule", "Admin, CS, Processor"],
          ["confirmation_sent", "Confirmation sent to CX", "Admin, CS"],
          ["waiting_schedule_confirmation", "Waiting for CX for schedule confirmation", "Admin, CS, Processor"],
          ["booked", "Booked", "Admin, CS"],
        ],
      },
      { type: "p", text: "Tags are only meaningful on the pre-scheduling statuses (waiting_complete_details through needs_reschedule). Tag assignment is enforced by the enforce_lead_tag_role_access() trigger." },
    ],
  },
  {
    id: "lead-card",
    title: "5. Lead Card Anatomy",
    blocks: [
      { type: "p", text: "The Lead Card is the primary list-view unit. Each card shows:" },
      { type: "bullet", text: "Job ID and status badge (pulsing green dot when status is payment_requested)." },
      { type: "bullet", text: "Customer name, phone (with Quo call/SMS shortcut), address." },
      { type: "bullet", text: "Service type and scheduled window (date + time range if set)." },
      { type: "bullet", text: "CS tag chip (if assigned) with priority sort influence." },
      { type: "bullet", text: "Note indicators: three dots (General / CS / Processor) that light up when notes exist for that thread." },
      { type: "bullet", text: "Amount and financial breakdown when the role is allowed to see it." },
      { type: "bullet", text: "Quick actions: change status, add note, share (Admin), copy, delete (Admin), reminder button." },
      { type: "bullet", text: "Auto-blinking indicators for Urgent Job and Need Tech." },
    ],
  },
  {
    id: "detail-panel",
    title: "6. Lead Detail Panel",
    blocks: [
      { type: "p", text: "Opening a card slides in a 60%-width right panel; the underlying list stays visible on the left and remains scrollable." },
      { type: "bullet", text: "Header: customer name, phone, address, status badge, action row." },
      { type: "bullet", text: "Address is a single free-form string (never split into city/state/zip in the form)." },
      { type: "bullet", text: "Collapsible sections: Customer Info, Service Details, Schedule, Financials, Tech Assignment, Notes, Updates, Photos, Cancellation, Payment Approval." },
      { type: "bullet", text: "Photos are stored in the private lead-photos bucket; every render fetches a fresh 1-hour signed URL." },
      { type: "bullet", text: "Every save syncs both updated_at and last_edited_at simultaneously." },
    ],
  },
  {
    id: "notes",
    title: "7. Notes Engine",
    blocks: [
      { type: "p", text: "Notes are threaded by type. Visibility is enforced at query time and in RLS." },
      {
        type: "table",
        headers: ["Thread", "Who writes", "Who sees"],
        rows: [
          ["General", "Any role with lead access", "Anyone with lead access"],
          ["CS notes", "CS, Admin", "CS, Admin"],
          ["Processor notes", "Processor, Admin", "Processor, Admin"],
        ],
      },
      { type: "p", text: "Dot indicators on the LeadCard reflect whether each thread has any note authored." },
    ],
  },
  {
    id: "creation",
    title: "8. Lead Creation & Editing",
    blocks: [
      { type: "p", text: "Only Admin and CS can create leads. The Add Lead dialog is a single scrollable form with collapsible sections. Required fields at creation:" },
      { type: "bullet", text: "Customer name" },
      { type: "bullet", text: "Customer phone (validated real-time against duplicates; block on match)" },
      { type: "bullet", text: "Address (single string)" },
      { type: "bullet", text: "Service type" },
      { type: "bullet", text: "Direction (incoming/outgoing) and Terms (free_estimate / quoted)" },
      { type: "p", text: "Drafts are auto-saved to lead_drafts so a session refresh does not lose work." },
    ],
  },
  {
    id: "sharing",
    title: "9. Lead Sharing & Visibility",
    blocks: [
      { type: "p", text: "CS users only see leads they created OR that were explicitly shared with them. Sharing rules:" },
      { type: "bullet", text: "Admin can share any lead with any CS user via the Share dialog on the card/panel." },
      { type: "bullet", text: "Shared users receive a notification." },
      { type: "bullet", text: "Sharing is stored in lead_shares (shared_with_user_id, shared_by)." },
      { type: "bullet", text: "Processor and Admin see all leads by default (subject to status visibility overrides in lead_status_visibility)." },
      { type: "bullet", text: "OPR sees only urgent_job and partial_paid globally." },
    ],
  },
  {
    id: "copy",
    title: "10. Copy Functionality",
    blocks: [
      { type: "p", text: "Two copy variants exist depending on the lead's Terms field:" },
      { type: "kv", label: "Free Estimate", value: "Service Details, Address, Schedule Requirement. No quote line." },
      { type: "kv", label: "Quoted", value: "Service Details, Address, Schedule Requirement, Quote." },
      { type: "p", text: "Copy targets both text/plain and text/html clipboards for compatibility with WhatsApp, iMessage, and email clients. Photos can be individually copied as PNG blobs." },
    ],
  },
  {
    id: "notifications",
    title: "11. Notifications",
    blocks: [
      { type: "p", text: "The bell icon shows unread notifications. Triggers:" },
      { type: "bullet", text: "Urgent Job status change → notifies Admin + CS." },
      { type: "bullet", text: "Need Tech status change → notifies Processor + Admin." },
      { type: "bullet", text: "Lead shared with a CS user → notifies that user." },
      { type: "bullet", text: "Cancellation request created → notifies Admin." },
      { type: "bullet", text: "Paid approval request created → notifies Admin." },
      { type: "bullet", text: "Cancellation / paid approval reviewed → notifies requester." },
      { type: "p", text: "Urgent Job also triggers the full-screen UrgentLeadPopup on the requester's clients." },
    ],
  },
  {
    id: "cancellation",
    title: "12. Cancellation Request Workflow",
    blocks: [
      { type: "bullet", text: "CS or Processor opens a lead and submits a Cancellation Request (comment + optional proof image)." },
      { type: "bullet", text: "Lead status flips to cancellation_requested; the previous status is stored on the request row." },
      { type: "bullet", text: "Admin reviews from the Cancellation Requests page (blinking green dot in the sidebar when pending exists)." },
      { type: "bullet", text: "Approve → lead status becomes cancelled. Reject → lead reverts to previous status." },
      { type: "bullet", text: "Requester receives a notification with the review note." },
    ],
  },
  {
    id: "paid-approval",
    title: "13. Paid Approval Workflow",
    blocks: [
      { type: "p", text: "Mirrors the cancellation flow for a Processor-initiated Paid request." },
      { type: "bullet", text: "Processor cannot mark a lead Paid directly. They submit a Paid Request (amount + screenshot + comment)." },
      { type: "bullet", text: "Lead status flips to payment_requested (pulsing green dot on the card)." },
      { type: "bullet", text: "The Paid Requests page is Admin-only, with a blinking green dot in the sidebar when pending exists." },
      { type: "bullet", text: "Approve → lead becomes paid with the provided amount + screenshot copied over. Paid is then locked forever." },
      { type: "bullet", text: "Reject → lead reverts to the previous status; Processor sees the note." },
      { type: "bullet", text: "Admin can still set Paid directly without any approval." },
    ],
  },
  {
    id: "scheduling",
    title: "14. Scheduling & Areas",
    blocks: [
      { type: "p", text: "The Schedule page shows the day's booked leads with tech, time window, and address." },
      { type: "p", text: "The Areas page renders a Leaflet map (plain L.map, no react-leaflet) using cached geocoding in localStorage. Marker color reflects lead status; the sidebar breakdown groups by status and area with a cross-tab and ranking list." },
    ],
  },
  {
    id: "activity",
    title: "15. Activity Logs & Audit",
    blocks: [
      { type: "p", text: "activity_logs captures every meaningful action: create, update, status change, note add, share, cancellation request, payment approval, delete. Each row stores user_id, user_name, action, target_type/id, details, timestamp. Deleting a user unassigns their leads and NULLs their user_id on logs and notes to keep history intact." },
    ],
  },
  {
    id: "quo-ai",
    title: "16. Quo AI Assistant (OpenPhone integration)",
    blocks: [
      { type: "p", text: "Quo mirrors OpenPhone conversations and layers AI classification, tagging, tasks, and daily briefs. Access is Admin-only (can_access_quo_ai())." },
      { type: "bullet", text: "Ingestion: quo-webhook receives real-time events; quo-reconcile-sync backfills missed webhooks every 10 minutes over a 24-hour window using paginated /v1/conversations + /v1/messages calls." },
      { type: "bullet", text: "Contacts sync: quo-sync-contacts pulls the OpenPhone contact list." },
      { type: "bullet", text: "Analysis: ai-process-quo-jobs consumes the quo_ai_jobs queue with debouncing; ai-sweep-conversations catches idle threads; ai-daily-brief produces summaries." },
      { type: "bullet", text: "Cron secret is stored in quo_ai_settings and read as a fallback for scheduled functions." },
      { type: "bullet", text: "Pinned conversations cap at 50 (enforced by trigger)." },
    ],
  },
  {
    id: "security",
    title: "17. Security & Authentication",
    blocks: [
      { type: "bullet", text: "Supabase Auth email/password. New signups create a profile row via handle_new_user()." },
      { type: "bullet", text: "MFA available; the MFAEnroll component walks a user through TOTP setup." },
      { type: "bullet", text: "Non-admin users must pass a 6-digit access code check on sensitive actions; the check is fail-closed and signs the user out on any verification error." },
      { type: "bullet", text: "RLS on every table. Roles live in user_roles; policies always call has_role() to avoid recursion." },
      { type: "bullet", text: "Edge functions use SB_SERVICE_ROLE_KEY (never expose service role to the browser)." },
      { type: "bullet", text: "lead-photos bucket is private; access is via short-lived signed URLs (1 hour)." },
    ],
  },
  {
    id: "data",
    title: "18. Data Management",
    blocks: [
      { type: "bullet", text: "Draft auto-save: lead_drafts persists in-progress forms." },
      { type: "bullet", text: "Admin global export: xlsx export across all leads." },
      { type: "bullet", text: "Timestamps: updated_at and last_edited_at are always synced together on lead updates." },
      { type: "bullet", text: "Deleted users: leads unassigned, notes/logs NULLed, permission rows removed." },
    ],
  },
  {
    id: "tech",
    title: "19. Technical Stack",
    blocks: [
      {
        type: "table",
        headers: ["Layer", "Technology"],
        rows: [
          ["Frontend", "React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui"],
          ["State/data", "TanStack Query, Supabase JS client, Realtime channels"],
          ["UI/UX", "Inter font, custom shadow tokens, Framer Motion (butterSpring)"],
          ["Map", "Leaflet (plain, not react-leaflet), localStorage geocoding cache"],
          ["Backend", "Supabase Postgres + RLS, Storage (lead-photos), Edge Functions (Deno)"],
          ["AI", "OpenAI + Lovable AI Gateway (models set via AI_MODEL_* env vars)"],
          ["Telephony", "OpenPhone / Quo API (api.openphone.com/v1) via webhook + reconcile jobs"],
          ["Testing", "Vitest, Playwright"],
        ],
      },
    ],
  },
];

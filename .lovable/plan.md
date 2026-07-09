## Paid Request Workflow

Mirrors the existing Lead Cancellation Request pattern so Processors can submit a "mark as Paid" request that Admin must approve before the lead flips to `paid`.

### Flow
1. Processor opens a lead and clicks **Request Paid** (visible only for Processor role, and only when lead isn't already `paid` / `cancelled` / has no pending payment request).
2. A dialog collects: payment amount (required), payment screenshot (required — same rule as direct Paid), and a comment.
3. Submitting creates a `lead_payment_requests` row (status `pending`), moves the lead status to a new `payment_requested` state, uploads the screenshot to the existing `lead-photos` bucket under `payment-requests/`, and notifies all Admins.
4. Admin sees pending requests in a new sidebar page **Paid Requests** (badge count, realtime updates) and inside the lead panel via a `PaymentRequestPanel` (identical layout to `CancellationRequestPanel`).
5. Admin approves → lead becomes `paid` with `payment_amount` + `payment_screenshot_url` copied from the request. Reject → lead reverts to the previous status; Processor sees the review note.
6. A **green dot** indicator renders on the lead card / status badge whenever the lead has status `payment_requested`, so it's instantly visible in lists.

### UI touchpoints
- New `PaymentRequestDialog` (amount + screenshot + comment) — reused by Processor from `LeadCard` and `LeadDetailPanel`.
- New `PaymentRequestPanel` inside `LeadDetailPanel` — Admin approve/reject with optional note.
- New page `/lead-payment-requests` (`LeadPaymentRequests.tsx`) listing pending requests, matching the cancellation page.
- Sidebar entry **Paid Requests** with pending count badge + realtime subscription on `lead_payment_requests`.
- Green pulsing dot on `LeadCard` header + `StatusBadge` when `status === 'payment_requested'`.
- Existing direct "mark Paid" action is hidden for Processor (they must go through the request); Admin keeps it.

### Technical details

**Database migration**
- Add enum value `payment_requested` to `lead_status`.
- Extend `LEAD_STATUS_CONFIG` label `"Paid Pending"`, color `status-green`.
- New table `public.lead_payment_requests`:
  - `id`, `lead_id` (fk leads, cascade), `previous_status`, `requested_by`, `requested_by_role`,
    `amount numeric`, `screenshot_path text`, `comment text`,
    `status` (`pending|approved|rejected`), `reviewed_by`, `reviewed_at`, `review_note`,
    `created_at`, `updated_at` (with trigger).
- GRANTs: `SELECT/INSERT/UPDATE` to `authenticated`, `ALL` to `service_role`.
- RLS:
  - insert: `requested_by = auth.uid()` AND `has_role(auth.uid(),'processor')`.
  - select: admin OR processor who created it OR CS with access to lead.
  - update: admin only (to review); or requester while `status='pending'` (cancel their own).
- Add `lead_payment_requests` to `supabase_realtime` publication.
- Update `enforce_lead_tag_role_access` / status transition rules only if needed (Processor can move lead into `payment_requested`; Admin transitions `payment_requested → paid|<previous>`).

**Client library** — `src/lib/payment-requests.ts`
- `canCreatePaymentRequest(role)` → `role === 'processor'`.
- `canReviewPaymentRequest(role, req)` → `role === 'admin' && req.status === 'pending'`.
- `fetchPendingPaymentRequest(leadId)` mirrors cancellation helper (joins requester profile).
- `createPaymentRequest({ lead, userId, amount, screenshot, comment })`: uploads screenshot, inserts row, updates lead status to `payment_requested` via `updateLeadById` (sync `updated_at` + `last_edited_at`), inserts admin notifications, calls `logActivity('payment_requested', ...)`.
- `reviewPaymentRequest({ request, lead, reviewerId, action, reviewNote })`: on approve, `updateLeadById(lead.id,{status:'paid', payment_amount:request.amount, payment_screenshot_url:<signed path>, ...})`; on reject, revert to `request.previous_status`. Logs `payment_approved` / `payment_rejected`.

**Nav / routing**
- Add `"payment_requests"` to `ALL_NAV_ITEMS` and `useNavPermissions` defaults for Admin + Processor.
- Add route in `App.tsx` for `/lead-payment-requests`.
- Extend `AppSidebar` with a second badge query + realtime channel scoped to `lead_payment_requests`.

**Green dot**
- Add small `<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />` next to `StatusBadge` in `LeadCard` and `LeadDetailPanel` when `lead.status === 'payment_requested'`. Also render inside the sidebar list row.

**Types** — extend `LeadStatus` union, add `LEAD_STATUS_CONFIG.payment_requested`, add `LeadPaymentRequest` interface (parallel to `LeadCancellationRequest`).

### Constraints respected
- Timestamps: `updateLeadById` keeps `updated_at` and `last_edited_at` in sync per project rule.
- "Paid" remains strictly locked once set — approval simply performs the same guarded transition Admin does manually today.
- Non-admins still fail-closed on access-code checks; no auth surface added.

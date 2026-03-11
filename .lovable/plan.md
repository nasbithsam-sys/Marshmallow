

## Plan: Lead Enhancements

### 1. Photo attachments on leads
- Add a photo upload section in `AddLeadDialog` and `LeadDetailPage` that uploads to the existing `lead-photos` storage bucket
- Store photo URLs in the `lead_photos` table (already exists per memory)
- On LeadCard, show thumbnail gallery of attached photos
- Clicking any photo opens a full-screen lightbox dialog with clear view

### 2. Lock status when "Paid"
- In `LeadCard.tsx`: disable the status `Select` when `lead.status === 'paid'`
- In `LeadDetailPage.tsx`: disable status select when `form.status === 'paid'` and it was loaded as paid (`previousStatus === 'paid'`)
- Show the payment screenshot on the LeadCard when status is paid, clickable to open lightbox

### 3. Start time AND end time in AddLeadDialog
- Currently AddLeadDialog only has one time picker (start). Add a second row for end time with the same hour/minute/AM-PM pattern
- Update the insert logic to use both `scheduled_time_start` and `scheduled_time_end`

### 4. General "Notes" field in lead form
- Add a `notes` textarea in `AddLeadDialog` (simple text, not CS or Processor specific)
- This maps to a new `lead_notes` entry with `note_type = 'general'` or we can use a simple column. Since `lead_notes` table already exists for threaded notes, we'll add a "General Notes" `NoteThread` with `noteType="general"` on the LeadCard and LeadDetailPage, visible to all roles

### 5. Payment screenshot on LeadCard
- Show a small thumbnail of `lead.payment_screenshot_url` when status is paid
- Click opens lightbox dialog

### Files to edit
1. **`src/components/leads/AddLeadDialog.tsx`** -- Add end time pickers, photo upload input, general notes field
2. **`src/components/leads/LeadCard.tsx`** -- Lock status when paid, show payment screenshot thumbnail + photo gallery, add General Notes thread, create lightbox for images
3. **`src/pages/LeadDetailPage.tsx`** -- Lock status when paid, add photo upload/gallery section, add General Notes thread
4. **`src/components/leads/ImageLightbox.tsx`** (new) -- Reusable fullscreen image viewer dialog




# Fix: Resolve Git Merge Conflict Markers Across 41 Files

## Problem

The entire project is broken due to **unresolved git merge conflict markers** in 41 files. Every file contains `<<<<<<< HEAD`, `=======`, and `>>>>>>> 06a14ca...` blocks, causing TypeScript/build failures everywhere.

## Root Cause

A git merge was attempted but never resolved. Both versions of code remain in the files with conflict markers separating them.

## Resolution Strategy

For each file, resolve conflicts by keeping the **HEAD version** (the newer/intended code) since that represents the latest planned changes (theme provider, PageRoute access control, premium styling, etc.). The HEAD side includes:

- `ThemeProvider` + `MotionConfig` wrappers in `main.tsx`
- `PageRoute` access control in `App.tsx`
- Premium glass-panel styling in `AppLayout.tsx`
- `ThemeToggle` in the header
- Typed interfaces in `LeadShareDialog.tsx`
- All other recent feature additions

## Files to Fix (41 total)

### Core App Files
- `src/main.tsx` — keep ThemeProvider + MotionConfig wrapper
- `src/App.tsx` — keep PageRoute access control
- `src/components/layout/AppLayout.tsx` — keep premium header with ThemeToggle
- `src/components/layout/AppSidebar.tsx`
- `src/contexts/AuthContext.tsx`

### Lead Components (heaviest conflicts)
- `src/pages/LeadDetailPage.tsx` — ~25 conflict blocks
- `src/components/leads/LeadCard.tsx`
- `src/components/leads/LeadDetailPanel.tsx`
- `src/components/leads/AddLeadDialog.tsx`
- `src/components/leads/LeadShareDialog.tsx`
- `src/components/leads/NoteThread.tsx`
- `src/components/leads/CopyLeadButton.tsx`
- `src/components/leads/StatusBadge.tsx`

### Pages
- `src/pages/LeadsPage.tsx`, `AllLeads.tsx`, `Analytics.tsx`, `AreasPage.tsx` (if present), `MapPage.tsx`, `SchedulePage.tsx`, `ActivityLogs.tsx`, `Settings.tsx`

### Hooks & Utilities
- `src/hooks/useAllowedStatuses.ts`, `useDuplicatePhoneCheck.ts`, `useNavPermissions.ts`
- `src/lib/constants.ts`, `src/lib/motion.ts`
- `src/integrations/supabase/types.ts`

### UI Components (13 files)
- `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `pagination.tsx`, `popover.tsx`, `select.tsx`, `sheet.tsx`, `sidebar.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`
- `src/components/notifications/NotificationBell.tsx`

## Approach

Each file will be read in full, the HEAD version of each conflict block will be kept, and the file will be rewritten clean. This is a large but mechanical fix — no logic changes, just removing conflict markers and keeping the correct side.


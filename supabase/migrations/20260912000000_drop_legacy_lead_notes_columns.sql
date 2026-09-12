-- Retire the legacy note columns on public.leads. All note reading and writing
-- now goes through the lead_notes thread system (used by both the lead card and
-- the lead detail views), so these columns are no longer referenced by the app.
--
-- This migration re-asserts the idempotent backfill first, so any note still
-- living only in a legacy column is copied into lead_notes before the columns
-- are dropped. The NOT EXISTS guards make the backfill safe to run again even
-- if 20260405123000_backfill_legacy_lead_notes.sql already ran.

-- 1. Re-assert backfill (idempotent) ----------------------------------------

INSERT INTO public.lead_notes (lead_id, user_id, note_type, content, created_at)
SELECT
  l.id,
  l.created_by,
  'general',
  btrim(l.general_notes),
  COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE NULLIF(btrim(l.general_notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_notes ln
    WHERE ln.lead_id = l.id
      AND ln.note_type = 'general'
      AND btrim(ln.content) = btrim(l.general_notes)
  );

INSERT INTO public.lead_notes (lead_id, user_id, note_type, content, created_at)
SELECT
  l.id,
  l.created_by,
  'cs',
  btrim(l.cs_notes),
  COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE NULLIF(btrim(l.cs_notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_notes ln
    WHERE ln.lead_id = l.id
      AND ln.note_type = 'cs'
      AND btrim(ln.content) = btrim(l.cs_notes)
  );

INSERT INTO public.lead_notes (lead_id, user_id, note_type, content, created_at)
SELECT
  l.id,
  l.created_by,
  'processor',
  btrim(l.processor_notes),
  COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE NULLIF(btrim(l.processor_notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_notes ln
    WHERE ln.lead_id = l.id
      AND ln.note_type = 'processor'
      AND btrim(ln.content) = btrim(l.processor_notes)
  );

-- 2. Drop the now-unused legacy columns --------------------------------------

ALTER TABLE public.leads DROP COLUMN IF EXISTS cs_notes;
ALTER TABLE public.leads DROP COLUMN IF EXISTS processor_notes;
ALTER TABLE public.leads DROP COLUMN IF EXISTS general_notes;

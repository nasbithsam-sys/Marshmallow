-- Backfill legacy note columns into lead_notes so cards and detail views
-- can use one consistent thread-based note system.
--
-- Safety rules:
-- 1. Only copy non-empty legacy notes.
-- 2. Do not create a duplicate thread note if the same lead/note_type/content
--    already exists in lead_notes.
-- 3. Keep the old columns untouched for now as a legacy fallback.

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

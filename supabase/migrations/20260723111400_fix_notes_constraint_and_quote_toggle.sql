-- =============================================================================
-- Fix lead notes constraint and add quote visibility toggle for operators
-- =============================================================================

-- 1. Add 'opr' to the allowed note types in lead_notes
ALTER TABLE public.lead_notes DROP CONSTRAINT IF EXISTS lead_notes_note_type_check;
ALTER TABLE public.lead_notes ADD CONSTRAINT lead_notes_note_type_check CHECK (note_type = ANY (ARRAY['cs'::text, 'processor'::text, 'general'::text, 'opr'::text]));

-- 2. Add show_quote_to_opr column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS show_quote_to_opr BOOLEAN DEFAULT true;

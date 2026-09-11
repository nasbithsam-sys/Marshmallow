-- Leads can be reached by cell phone, landline, or both.
--
-- The landline gets its own column. customer_phone keeps its NOT NULL constraint and holds an
-- empty string when a lead only has a landline, so nothing that reads it as text has to change.
-- The "at least one number" rule lives in the lead forms, where the old "phone required" rule
-- lived.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_landline text;

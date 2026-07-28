-- Fix duplicate indexes flagged by the linter
DROP INDEX IF EXISTS public.idx_leads_created_at;
DROP INDEX IF EXISTS public.idx_leads_status;
DROP INDEX IF EXISTS public.technicians_name_idx1;

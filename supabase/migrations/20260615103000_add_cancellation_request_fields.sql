ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cancellation_proof TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_requested_role TEXT;

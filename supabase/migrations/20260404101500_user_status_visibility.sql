ALTER TABLE public.lead_status_visibility
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.lead_status_visibility
  ALTER COLUMN role DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lead_status_visibility_user_status_key
  ON public.lead_status_visibility (user_id, status)
  WHERE user_id IS NOT NULL;

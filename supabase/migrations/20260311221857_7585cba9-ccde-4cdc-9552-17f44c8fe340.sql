
-- 1. Add 12 missing columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS number_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quote TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_details TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_schedule_requirements TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reference_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tech_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tech_number TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS labor_amount NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS material_amount NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS for_you_amount NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS for_us_amount NUMERIC;

-- 2. Create lead_payments table
CREATE TABLE IF NOT EXISTS public.lead_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lead_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read payments" ON public.lead_payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert payments" ON public.lead_payments
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can delete payments" ON public.lead_payments
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix notifications RLS: drop ALL policy, add granular policies
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;

CREATE POLICY "Users can select own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

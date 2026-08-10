-- Allow all authenticated users to read and manage quo_number_preferences

ALTER TABLE public.quo_number_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read quo number preferences" ON public.quo_number_preferences;
DROP POLICY IF EXISTS "Allow authenticated read on quo_number_preferences" ON public.quo_number_preferences;
CREATE POLICY "Allow authenticated read on quo_number_preferences"
  ON public.quo_number_preferences FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage quo number preferences" ON public.quo_number_preferences;
DROP POLICY IF EXISTS "Allow authenticated insert on quo_number_preferences" ON public.quo_number_preferences;
CREATE POLICY "Allow authenticated insert on quo_number_preferences"
  ON public.quo_number_preferences FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update on quo_number_preferences" ON public.quo_number_preferences;
CREATE POLICY "Allow authenticated update on quo_number_preferences"
  ON public.quo_number_preferences FOR UPDATE TO authenticated
  USING (true);

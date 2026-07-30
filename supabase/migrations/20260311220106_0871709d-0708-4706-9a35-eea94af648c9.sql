
-- Fix activity_logs INSERT to require user_id matches caller
DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated can insert own logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix lead_photos INSERT and DELETE
DROP POLICY IF EXISTS "Authenticated users can insert lead photos" ON public.lead_photos;
CREATE POLICY "Authenticated users can insert lead photos"
  ON public.lead_photos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can delete lead photos" ON public.lead_photos;
CREATE POLICY "Admins can delete lead photos"
  ON public.lead_photos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR uploaded_by = auth.uid());

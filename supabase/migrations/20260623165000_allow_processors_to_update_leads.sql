DROP POLICY IF EXISTS "Authorized users can update leads" ON public.leads;

CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
  );

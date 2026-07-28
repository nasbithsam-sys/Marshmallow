DROP POLICY IF EXISTS "Authorized users can update leads" ON public.leads;

CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR assigned_cs = (select auth.uid())
    OR public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'processor')
  )
  WITH CHECK (
    created_by = (select auth.uid())
    OR assigned_cs = (select auth.uid())
    OR public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'processor')
  );

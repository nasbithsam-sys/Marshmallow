-- CS Admins can now create leads with the same access a CS has. No INSERT policy for
-- public.leads exists in this migration history (it predates it or was made in the dashboard),
-- so rather than replace a policy that cannot be seen from here, this adds a narrow additive
-- one. Postgres ORs permissive policies, so if CS Admins were already allowed to insert this
-- changes nothing; if they were not, it permits exactly this case: a CS Admin creating a lead
-- owned by themselves.
DROP POLICY IF EXISTS "CS Admins can create their own leads" ON public.leads;
CREATE POLICY "CS Admins can create their own leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'cs_admin'::public.app_role)
  );

-- =============================================================================
-- Add SELECT policy for user_roles so processors can fetch the list of operators
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;

CREATE POLICY "Authenticated users can read roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

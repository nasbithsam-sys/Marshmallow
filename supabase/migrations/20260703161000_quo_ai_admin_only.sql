CREATE OR REPLACE FUNCTION public.can_access_quo_ai()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

DELETE FROM public.navigation_permissions AS np
WHERE np.nav_section = 'quo_monitor'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = np.user_id
      AND ur.role = 'admin'::public.app_role
  );

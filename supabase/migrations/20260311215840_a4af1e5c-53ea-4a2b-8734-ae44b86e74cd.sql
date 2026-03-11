
-- Fix 1: user_roles - restrict INSERT/UPDATE/DELETE to admins only (prevents privilege escalation)
DROP POLICY IF EXISTS "Authenticated can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can update roles" ON public.user_roles;

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: status_permissions - restrict write to admins only
DROP POLICY IF EXISTS "Admins manage status permissions" ON public.status_permissions;

CREATE POLICY "Authenticated can read status permissions"
  ON public.status_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert status permissions"
  ON public.status_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update status permissions"
  ON public.status_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete status permissions"
  ON public.status_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: leads - restrict UPDATE to owner, assigned CS, or admin
DROP POLICY IF EXISTS "Authenticated can update leads" ON public.leads;

CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Fix 4: profiles - restrict INSERT to own profile or admin
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

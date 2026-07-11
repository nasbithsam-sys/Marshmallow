-- Remove "no_role" from the app_role enum and clean up any existing rows using it.

-- Delete any user_roles rows that still hold the deprecated value.
DELETE FROM public.user_roles WHERE role = 'no_role';

-- Rename the current enum so we can create a clean replacement while keeping
-- existing policy bindings intact (they reference the type by OID).
ALTER TYPE public.app_role RENAME TO app_role_old;

-- New enum without "no_role".
CREATE TYPE public.app_role AS ENUM ('admin', 'processor', 'customer_service', 'opr');

-- Rewrite has_role's body to compare by text so it works regardless of which
-- enum variant is passed. The existing function signature is now
-- has_role(uuid, app_role_old) after the rename; all existing policies that
-- reference has_role were compiled against that OID and keep working.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role_old)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  )
$$;

-- Convert the user_roles.role column to the new enum.
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING role::text::public.app_role;

-- Overload has_role for the new enum type so new callers work too.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;


-- Revoke anon EXECUTE on RLS helper functions. Authenticated users must keep
-- EXECUTE because policies invoke these under the caller's role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_quo_ai() FROM anon, PUBLIC;

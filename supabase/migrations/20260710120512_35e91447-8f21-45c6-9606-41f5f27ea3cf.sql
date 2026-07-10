REVOKE ALL ON FUNCTION public.can_access_quo_ai() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_quo_ai() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_quo_ai() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_quo_ai() TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
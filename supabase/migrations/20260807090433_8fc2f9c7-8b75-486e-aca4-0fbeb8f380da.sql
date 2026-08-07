GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role_old) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_quo_ai() TO authenticated, service_role;
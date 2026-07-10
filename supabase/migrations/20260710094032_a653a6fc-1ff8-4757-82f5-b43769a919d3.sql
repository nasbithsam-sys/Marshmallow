
-- Re-grant EXECUTE to authenticated so RLS policies that call these helpers keep working.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_quo_ai() TO authenticated;

-- rls_auto_enable is an event trigger (not RPC-callable) but still flagged. Revoke anyway.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;

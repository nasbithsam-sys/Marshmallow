REVOKE ALL ON FUNCTION public.handle_user_delete_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_user_delete_cleanup() FROM anon;
REVOKE ALL ON FUNCTION public.handle_user_delete_cleanup() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_delete_cleanup() TO service_role;
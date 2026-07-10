CREATE OR REPLACE FUNCTION public.handle_user_delete_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  preserved_name text;
BEGIN
  SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Deleted user')
  INTO preserved_name
  FROM public.profiles
  WHERE id = OLD.id;

  UPDATE public.profiles
  SET full_name = regexp_replace(COALESCE(preserved_name, 'Deleted user'), '\s*\(deleted\)$', '', 'i') || ' (deleted)'
  WHERE id = OLD.id;

  -- Remove only access-control records. CRM history remains attached to the preserved profile/user id.
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.navigation_permissions WHERE user_id = OLD.id;
  DELETE FROM public.status_permissions WHERE user_id = OLD.id;
  DELETE FROM public.notifications WHERE user_id = OLD.id;
  DELETE FROM public.user_access_codes WHERE user_id = OLD.id;

  RETURN OLD;
END;
$function$;
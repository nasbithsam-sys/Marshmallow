CREATE OR REPLACE FUNCTION public.handle_user_delete_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Clear nullable references to the deleted user so historical lead records remain.
  UPDATE public.leads
  SET created_by = NULL
  WHERE created_by = OLD.id;

  UPDATE public.leads
  SET assigned_cs = NULL
  WHERE assigned_cs = OLD.id;

  UPDATE public.leads
  SET last_edited_by = NULL
  WHERE last_edited_by = OLD.id;

  UPDATE public.activity_logs
  SET user_id = NULL
  WHERE user_id = OLD.id;

  UPDATE public.lead_photos
  SET uploaded_by = NULL
  WHERE uploaded_by = OLD.id;

  -- Remove dependent records that require a non-null user reference or represent user-specific settings.
  DELETE FROM public.lead_notes WHERE user_id = OLD.id;
  DELETE FROM public.lead_updates WHERE author_id = OLD.id;
  DELETE FROM public.lead_shares WHERE shared_with_user_id = OLD.id OR shared_by = OLD.id;
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.navigation_permissions WHERE user_id = OLD.id;
  DELETE FROM public.status_permissions WHERE user_id = OLD.id;
  DELETE FROM public.notifications WHERE user_id = OLD.id;
  DELETE FROM public.user_access_codes WHERE user_id = OLD.id;

  -- Remove the profile last. Tables that reference profiles with CASCADE/SET NULL can react safely.
  DELETE FROM public.profiles WHERE id = OLD.id;

  RETURN OLD;
END;
$function$;
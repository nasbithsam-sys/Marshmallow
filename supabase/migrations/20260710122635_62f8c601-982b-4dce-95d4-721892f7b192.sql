ALTER TABLE public.lead_payments DROP CONSTRAINT IF EXISTS lead_payments_created_by_fkey;
ALTER TABLE public.lead_payments
  ADD CONSTRAINT lead_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_lead_payment_user_snapshot_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.created_by IS NOT NULL AND NEW.created_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.created_by_name
    FROM public.profiles WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_lead_payment_user_snapshot_name ON public.lead_payments;
CREATE TRIGGER set_lead_payment_user_snapshot_name
  BEFORE INSERT OR UPDATE ON public.lead_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_payment_user_snapshot_name();

REVOKE ALL ON FUNCTION public.set_lead_payment_user_snapshot_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_lead_payment_user_snapshot_name() FROM anon;
REVOKE ALL ON FUNCTION public.set_lead_payment_user_snapshot_name() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_payment_user_snapshot_name() TO service_role;
CREATE OR REPLACE FUNCTION public.quo_conversation_counts_by_number()
RETURNS TABLE(phone_number_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT number_id AS phone_number_id, count(*)::bigint AS total
  FROM public.quo_conversations
  WHERE customer_number IS NOT NULL AND customer_number <> ''
  GROUP BY number_id;
$$;

GRANT EXECUTE ON FUNCTION public.quo_conversation_counts_by_number() TO authenticated, service_role;
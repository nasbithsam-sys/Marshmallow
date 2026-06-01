CREATE TABLE public.user_status_change_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  allowed_statuses TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_status_change_permissions TO authenticated;
GRANT ALL ON public.user_status_change_permissions TO service_role;

ALTER TABLE public.user_status_change_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all status change permissions"
ON public.user_status_change_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own status change permissions"
ON public.user_status_change_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_status_change_permissions_updated_at
BEFORE UPDATE ON public.user_status_change_permissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
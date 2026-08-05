INSERT INTO public.user_roles (user_id, role)
VALUES ('8e2c5c33-a74c-4e8d-b588-45f528fbd6e7', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = '8e2c5c33-a74c-4e8d-b588-45f528fbd6e7'
  AND role <> 'admin'::public.app_role;
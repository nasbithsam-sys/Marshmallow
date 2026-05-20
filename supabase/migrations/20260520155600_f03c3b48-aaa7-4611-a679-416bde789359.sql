DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    'admin@accboosters.com', crypt('AdminBoost!2026', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}',
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id, 'admin@accboosters.com')::jsonb,
    'email', new_user_id::text, now(), now(), now());

  INSERT INTO public.profiles (id, full_name, email) VALUES (new_user_id, 'Admin', 'admin@accboosters.com')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin')
  ON CONFLICT DO NOTHING;
END $$;
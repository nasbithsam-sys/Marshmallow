UPDATE auth.users 
SET encrypted_password = crypt('AdminBoost2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@accboosters.com';

INSERT INTO public.profiles (id, full_name, email)
SELECT 'bfdfa0f2-c05a-4f63-aee3-8900f01340c8', 'Admin', 'admin@accboosters.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('bfdfa0f2-c05a-4f63-aee3-8900f01340c8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
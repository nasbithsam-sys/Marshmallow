-- Ensure all foreign keys referencing auth.users or public.profiles are configured with ON DELETE CASCADE or ON DELETE SET NULL.
-- This prevents orphaned auth accounts and ensures clean user deletion.
DO $$
DECLARE
    r RECORD;
    alter_sql TEXT;
BEGIN
    FOR r IN 
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            (SELECT is_nullable = 'NO' 
             FROM information_schema.columns 
             WHERE table_schema = tc.table_schema 
               AND table_name = tc.table_name 
               AND column_name = kcu.column_name) AS is_not_null
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN pg_catalog.pg_constraint con 
              ON con.conname = tc.constraint_name
              AND con.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = tc.table_schema)
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name IN ('users', 'profiles') -- references auth.users or public.profiles
          AND con.confdeltype NOT IN ('c', 'n') -- not CASCADE ('c') and not SET NULL ('n')
    LOOP
        -- Drop constraint safely
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.table_schema, r.table_name, r.constraint_name);
        
        -- Re-create constraint with ON DELETE CASCADE (if not nullable) or ON DELETE SET NULL (if nullable)
        IF r.is_not_null THEN
            alter_sql := format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE CASCADE',
                r.table_schema, r.table_name, r.constraint_name, r.column_name,
                CASE WHEN r.foreign_table_name = 'users' THEN 'auth.users' ELSE 'public.profiles' END,
                r.foreign_column_name
            );
        ELSE
            alter_sql := format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE SET NULL',
                r.table_schema, r.table_name, r.constraint_name, r.column_name,
                CASE WHEN r.foreign_table_name = 'users' THEN 'auth.users' ELSE 'public.profiles' END,
                r.foreign_column_name
            );
        END IF;
        
        EXECUTE alter_sql;
    END LOOP;
END $$;

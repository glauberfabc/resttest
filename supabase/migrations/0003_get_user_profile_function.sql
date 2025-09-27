-- supabase/migrations/0003_get_user_profile_function.sql
DROP POLICY IF EXISTS "Allow authenticated users to call get_user_profile" ON functions;
DROP FUNCTION IF EXISTS public.get_user_profile();

CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS TABLE (
    id uuid,
    name text,
    role app_role
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.role
    FROM
        public.profiles p
    WHERE
        p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_profile() TO authenticated;

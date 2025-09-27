CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS TABLE (
    name text,
    role app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function runs with the privileges of the user who created it,
    -- bypassing RLS to fetch the user's own profile data securely.
    RETURN QUERY
    SELECT
        p.name,
        p.role
    FROM
        public.profiles p
    WHERE
        p.id = auth.uid();
END;
$$;
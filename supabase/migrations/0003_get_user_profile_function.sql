-- Function to get a user's profile (name and role)
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS TABLE (name text, role app_role)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.name,
        p.role
    FROM
        public.profiles p
    WHERE
        p.id = auth.uid();
$$;

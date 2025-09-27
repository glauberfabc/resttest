create or replace function get_user_profile()
returns table (
    name text,
    role app_role
)
language sql
security definer
set search_path = public
as $$
    select
        p.name,
        p.role
    from profiles p
    where p.id = auth.uid()
$$;

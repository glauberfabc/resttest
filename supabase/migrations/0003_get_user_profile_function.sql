-- Function to get user profile
create or replace function public.get_user_profile()
returns table (
    name text,
    role text
)
language sql
security definer
as $$
    select
        p.name,
        p.role
    from public.profiles p
    where p.id = auth.uid();
$$;

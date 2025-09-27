-- Function to get user profile
create or replace function public.get_user_profile()
returns table (
  id uuid,
  name text,
  role text
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.name,
    profiles.role
  from profiles
  where profiles.id = auth.uid()
$$;

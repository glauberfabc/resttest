
-- Create a function to safely get the user's profile
-- This function can be called from the client-side code using supabase.rpc('get_user_profile')
create or replace function public.get_user_profile()
returns table (name text, role app_role)
language sql
security definer
set search_path = public
as $$
  select
    profiles.name,
    profiles.role
  from public.profiles
  where profiles.id = auth.uid()
$$;

-- Grant execution of the function to authenticated users
grant execute on function public.get_user_profile() to authenticated;


-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;

-- Drop existing policies and functions to ensure a clean migration
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;


-- Function to get user_id from JWT claims, avoiding recursion
create or replace function public.current_user_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
$$;


-- Policies for profiles
create policy "Users can insert their own profile." on public.profiles for insert with check ( auth.uid() = id );
create policy "Users can view their own profile." on public.profiles for select using ( auth.uid() = id );
create policy "Users can update own profile." on public.profiles for update using ( auth.uid() = id );


-- Policies for menu_items
create policy "Users can manage their own menu items." on public.menu_items for all
    using ( auth.uid() = user_id )
    with check ( auth.uid() = user_id );

-- Policies for clients
create policy "Users can manage their own clients." on public.clients for all
    using ( auth.uid() = user_id )
    with check ( auth.uid() = user_id );


-- Function and Trigger for new user profiles (this part is ok, as it runs after user creation, not during a select)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, new.raw_user_meta_data->>'name', new.email, 'collaborator');
  return new;
end;
$$;

-- drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


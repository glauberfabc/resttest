-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;

-- Drop old function and policies if they exist to avoid conflicts
drop function if exists public.get_user_id_from_claims() cascade;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

-- Function to get user ID from JWT claims, avoiding recursion
create or replace function public.get_user_id_from_claims()
returns uuid
language sql stable
as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$;


-- Policies for profiles
create policy "Users can insert their own profile." on public.profiles
  for insert with check ( get_user_id_from_claims() = id );

create policy "Users can view their own profile." on public.profiles
  for select using ( get_user_id_from_claims() = id );

create policy "Users can update own profile." on public.profiles
  for update using ( get_user_id_from_claims() = id );


-- Policies for menu_items
drop policy if exists "Users can manage their own menu items." on public.menu_items;
create policy "Users can manage their own menu items." on public.menu_items
  for all using ( get_user_id_from_claims() = user_id );


-- Policies for clients
drop policy if exists "Users can manage their own clients." on public.clients;
create policy "Users can manage their own clients." on public.clients
  for all using ( get_user_id_from_claims() = user_id );

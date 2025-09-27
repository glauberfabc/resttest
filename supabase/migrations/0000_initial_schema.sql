
-- Create profiles table
create table if not exists public.profiles (
  id uuid not null primary key,
  name text,
  email text,
  role text,
  user_id uuid references auth.users (id) on delete cascade
);

-- Create menu_items table
create table if not exists public.menu_items (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  user_id uuid references auth.users (id) on delete cascade
);

-- Create clients table
create table if not exists public.clients (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  phone text,
  document text,
  user_id uuid references auth.users (id) on delete cascade
);

-- Drop policies first to avoid dependency errors
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

drop policy if exists "Users can manage their own menu items." on public.menu_items;

drop policy if exists "Users can manage their own clients." on public.clients;

-- Drop the function after dropping the policies that depend on it
drop function if exists public.authorizing_user_id();

-- Function to get user ID from JWT claims, avoiding recursion
create function public.authorizing_user_id()
returns uuid
language sql stable
as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$;


-- Enable RLS for all tables
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;

-- Recreate policies for profiles using the new function
create policy "Users can insert their own profile." on public.profiles for insert with check ( authorizing_user_id() = user_id );
create policy "Users can view their own profile." on public.profiles for select using ( authorizing_user_id() = user_id );
create policy "Users can update own profile." on public.profiles for update using ( authorizing_user_id() = user_id );

-- Recreate policies for menu_items using the new function
create policy "Users can manage their own menu items." on public.menu_items for all using ( authorizing_user_id() = user_id );

-- Recreate policies for clients using the new function
create policy "Users can manage their own clients." on public.clients for all using ( authorizing_user_id() = user_id );


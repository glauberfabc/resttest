-- Create profiles table
create table if not exists public.profiles (
  id uuid not null primary key,
  name text,
  email text,
  role text default 'collaborator'
);
-- Create menu_items table
create table if not exists public.menu_items (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  description text,
  price real not null,
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
-- Secure the tables with Row-Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
-- Function to get the user ID from JWT claims
drop function if exists public.authorizing_user_id();
create or replace function public.authorizing_user_id() returns uuid language sql stable security definer as $$
select nullif (
    current_setting('request.jwt.claims', true),
    ''
  )::jsonb ->> 'sub';
$$;
-- Policies for profiles
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for
insert with check (authorizing_user_id() = id);
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile." on public.profiles for
select using (authorizing_user_id() = id);
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for
update using (authorizing_user_id() = id);
-- Policies for menu_items
drop policy if exists "Users can do anything on their own menu items" on public.menu_items;
create policy "Users can do anything on their own menu items" on public.menu_items for all using (authorizing_user_id() = user_id) with check (authorizing_user_id() = user_id);
-- Policies for clients
drop policy if exists "Users can do anything on their own clients" on public.clients;
create policy "Users can do anything on their own clients" on public.clients for all using (authorizing_user_id() = user_id) with check (authorizing_user_id() = user_id);
-- Remove old trigger and function if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;
drop function if exists public.get_user_id;
drop function if exists public.get_my_claims;
drop function if exists public.get_current_user_id;
drop function if exists public.requesting_user_id;
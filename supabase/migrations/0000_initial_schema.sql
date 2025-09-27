-- 
-- For details on creating policies, see https://supabase.com/docs/guides/auth/row-level-security.
-- 

-- First, drop all policies and the helper function if they exist to ensure a clean slate.
-- Using CASCADE to resolve dependency issues during dropping.
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  name text,
  email text,
  role text DEFAULT 'collaborator'::text,
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);
comment on table public.profiles is 'User profiles';

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  CONSTRAINT menu_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);
comment on table public.menu_items is 'Menu items for the restaurant';

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  document text,
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);
comment on table public.clients is 'Customer information';

-- Function to get the current user's ID from JWT claims, avoiding RLS infinite recursion.
create or replace function public.current_user_id()
returns uuid
language sql stable
as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$;
comment on function public.current_user_id() is 'Get the user ID from the JWT claims.';

-- Policies for profiles
create policy "Users can insert their own profile." on public.profiles for insert
  with check ( current_user_id() = id );

create policy "Users can view their own profile." on public.profiles for select
  using ( current_user_id() = id );

create policy "Users can update own profile." on public.profiles for update
  using ( current_user_id() = id );

-- Policies for menu_items
create policy "Users can manage their own menu items." on public.menu_items for all
  using ( current_user_id() = user_id );

-- Policies for clients
create policy "Users can manage their own clients." on public.clients for all
  using ( current_user_id() = user_id );

-- Enable RLS for all tables
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;

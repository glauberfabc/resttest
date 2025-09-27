-- Create profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email varchar(255),
  name text,
  role text,
  primary key (id)
);
alter table public.profiles enable row level security;

-- Create menu_items table
create table public.menu_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  primary key (id)
);
alter table public.menu_items enable row level security;

-- Create clients table
create table public.clients (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  phone text,
  document text,
  primary key (id)
);
alter table public.clients enable row level security;

-- Secure authorizing_user_id function
create or replace function public.authorizing_user_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
$$;

-- Policies for profiles
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check ( authorizing_user_id() = id );

drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile." on public.profiles for select using ( authorizing_user_id() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using ( authorizing_user_id() = id );

-- Policies for menu_items
drop policy if exists "Users can do anything on their own menu items" on public.menu_items;
create policy "Users can do anything on their own menu items" on public.menu_items for all using ( authorizing_user_id() = user_id );

-- Policies for clients
drop policy if exists "Users can do anything on their own clients" on public.clients;
create policy "Users can do anything on their own clients" on public.clients for all using ( authorizing_user_id() = user_id );

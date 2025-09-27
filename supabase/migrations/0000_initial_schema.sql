-- supabase/migrations/0000_initial_schema.sql

-- Function to get the user ID from the JWT claims
create or replace function public.requesting_user_id()
returns uuid as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$ language sql stable;


-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  name text,
  role text default 'collaborator'
);
alter table public.profiles enable row level security;


-- Policies for profiles
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile."
  on public.profiles for select
  using ( requesting_user_id() = id );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( requesting_user_id() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( requesting_user_id() = id );


-- Create menu_items table
create table if not exists public.menu_items (
    id uuid not null primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    description text,
    price real not null,
    category text,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.menu_items enable row level security;

-- Policies for menu_items
drop policy if exists "Users can manage their own menu items." on public.menu_items;
create policy "Users can manage their own menu items."
    on public.menu_items for all
    using ( auth.uid() = user_id );

drop policy if exists "Menu items are viewable by authenticated users." on public.menu_items;
create policy "Menu items are viewable by authenticated users."
    on public.menu_items for select
    using ( auth.role() = 'authenticated' );


-- Create clients table
create table if not exists public.clients (
    id uuid not null primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    phone text,
    document text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.clients enable row level security;

-- Policies for clients
drop policy if exists "Users can manage their own clients." on public.clients;
create policy "Users can manage their own clients."
    on public.clients for all
    using ( auth.uid() = user_id );

-- Create product_images bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product_images', 'product_images', true, 2097152, '{"image/*"}' )
on conflict (id) do nothing;

-- Policies for product_images bucket
drop policy if exists "Users can manage their own product images." on storage.objects;
create policy "Users can manage their own product images."
    on storage.objects for all
    using ( bucket_id = 'product_images' and owner = auth.uid() );

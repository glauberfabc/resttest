-- supabase/migrations/0000_initial_schema.sql

-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid not null primary key,
  email text,
  name text,
  role text default 'collaborator'
);
alter table public.profiles enable row level security;

-- Policies for profiles
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile."
  on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Create menu_items table
create table if not exists public.menu_items (
    id uuid not null primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
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

drop policy if exists "Menu items are viewable by everyone." on public.menu_items;
create policy "Menu items are viewable by everyone."
    on public.menu_items for select
    using ( true );

-- Create clients table
create table if not exists public.clients (
    id uuid not null primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
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
drop policy if exists "Allow all access to product_images" on storage.objects;
create policy "Allow all access to product_images"
    on storage.objects for all
    using ( bucket_id = 'product_images' );

-- Drop tables with cascade to remove dependent objects
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

-- Create a helper function to get the current user's ID from the JWT claims
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid not null primary key,
  "name" text null,
  "role" text null default 'collaborator'::text,
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);
alter table public.profiles enable row level security;

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid null,
    name text null,
    description text null,
    price numeric null,
    category text null,
    "imageUrl" text null,
    stock integer null,
    "lowStockThreshold" integer null,
    unit text null,
    constraint menu_items_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.menu_items enable row level security;

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid null,
    name text null,
    phone text null,
    document text null,
    constraint clients_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.clients enable row level security;

-- Policies for profiles
create policy "Users can insert their own profile." on public.profiles for insert with check (current_user_id() = id);
create policy "Users can view their own profile." on public.profiles for select using (current_user_id() = id);
create policy "Users can update own profile." on public.profiles for update using (current_user_id() = id);

-- Policies for menu_items
create policy "Users can manage their own menu items." on public.menu_items for all using (current_user_id() = user_id);

-- Policies for clients
create policy "Users can manage their own clients." on public.clients for all using (current_user_id() = user_id);


-- Function to create a profile for a new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

-- Trigger to create a profile when a new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable image uploads for authenticated users
drop policy if exists "Authenticated users can upload images." on storage.objects;
create policy "Authenticated users can upload images." on storage.objects for insert to authenticated with check (true);

drop policy if exists "Anyone can view public images." on storage.objects;
CREATE POLICY "Anyone can view public images." ON storage.objects FOR SELECT USING ( bucket_id = 'images' );

drop policy if exists "Admins can update product images." on storage.objects;
create policy "Admins can update product images."
on storage.objects
for update to authenticated
using (
  bucket_id = 'images'
  and (select role from public.profiles where id = current_user_id()) = 'admin'
);

drop policy if exists "Admins can delete product images." on storage.objects;
create policy "Admins can delete product images."
on storage.objects
for delete to authenticated
using (
  bucket_id = 'images'
  and (select role from public.profiles where id = current_user_id()) = 'admin'
);

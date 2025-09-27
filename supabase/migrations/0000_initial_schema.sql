-- Drop existing objects to start fresh, using CASCADE to handle dependencies
drop table if exists public.menu_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.orders cascade;
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;
drop table if exists public.profiles cascade;

-- Drop function if it exists
drop function if exists public.current_user_id() cascade;
drop function if exists public.handle_new_user() cascade;

-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'collaborator',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create menu_items table
create table if not exists public.menu_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    price numeric not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    user_id uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create clients table
create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    document text,
    user_id uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create orders table
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    identifier text not null,
    status text not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    paid_at timestamp with time zone
);

-- Create order_items table
create table if not exists public.order_items (
    order_id uuid references public.orders(id) on delete cascade,
    menu_item_id uuid references public.menu_items(id) on delete restrict,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

-- Create order_payments table
create table if not exists public.order_payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete cascade,
    amount numeric not null,
    method text not null,
    paid_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- Function to get current user ID from JWT
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email, 'collaborator');
  return new;
end;
$$;

-- Trigger to call handle_new_user on new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- POLICIES
-- Profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

create policy "Users can insert their own profile." on public.profiles for insert
    with check ( user_id = public.current_user_id() );

create policy "Users can view their own profile." on public.profiles for select
    using ( id = public.current_user_id() );

create policy "Users can update own profile." on public.profiles for update
    using ( user_id = public.current_user_id() );

-- Menu Items
alter table public.menu_items enable row level security;
drop policy if exists "Users can manage their own menu items." on public.menu_items;

create policy "Users can manage their own menu items." on public.menu_items for all
    using ( user_id = public.current_user_id() );

-- Clients
alter table public.clients enable row level security;
drop policy if exists "Users can manage their own clients." on public.clients;

create policy "Users can manage their own clients." on public.clients for all
    using ( user_id = public.current_user_id() );

-- Orders
alter table public.orders enable row level security;
drop policy if exists "Users can manage their own orders." on public.orders;
drop policy if exists "Users can view their own orders." on public.orders;

create policy "Users can manage their own orders." on public.orders for all
    using ( user_id = public.current_user_id() );
    
create policy "Users can view their own orders." on public.orders for select
    using ( user_id = public.current_user_id() );


-- Order Items
alter table public.order_items enable row level security;
-- This policy assumes that if a user can see the order, they can see the items.
-- It checks if the user_id on the associated order matches the current user.
drop policy if exists "Users can manage items for their own orders." on public.order_items;

create policy "Users can manage items for their own orders." on public.order_items for all
    using (
        (select user_id from public.orders where id = order_id) = public.current_user_id()
    );

-- Order Payments
alter table public.order_payments enable row level security;
-- This policy assumes that if a user can see the order, they can see the payments.
drop policy if exists "Users can manage payments for their own orders." on public.order_payments;

create policy "Users can manage payments for their own orders." on public.order_payments for all
    using (
        (select user_id from public.orders where id = order_id) = public.current_user_id()
    );

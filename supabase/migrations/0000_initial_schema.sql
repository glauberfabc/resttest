
-- Custom types
drop type if exists public.user_role;
create type public.user_role as enum ('admin', 'collaborator');

-- Clean up existing tables
drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

-- profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text not null,
  email text not null,
  role user_role not null default 'collaborator'
);
comment on table public.profiles is 'Profile data for each user.';
comment on column public.profiles.id is 'References the user in auth.users.';

-- menu_items table
create table if not exists public.menu_items (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    user_id uuid references public.profiles(id) on delete cascade not null
);

-- clients table
create table if not exists public.clients (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    phone text,
    document text,
    user_id uuid references public.profiles(id) on delete cascade not null
);

-- orders table
create table if not exists public.orders (
    id uuid default gen_random_uuid() primary key,
    type text not null,
    identifier text not null,
    status text not null,
    created_at timestamptz default now(),
    paid_at timestamptz,
    user_id uuid references public.profiles(id) on delete cascade not null
);

-- order_items table
create table if not exists public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    menu_item_id uuid references public.menu_items(id) on delete cascade not null,
    quantity integer not null,
    unique(order_id, menu_item_id)
);

-- order_payments table
create table if not exists public.order_payments (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamptz default now()
);


-- Function to get current user id
drop function if exists public.current_user_id;
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;


-- Function to handle new user
drop function if exists public.handle_new_user;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Novo Usuário'),
    new.email,
    'collaborator'
  );
  return new;
end;
$$;


-- RLS Policies
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;

-- Drop existing policies
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can manage their own menu items." on public.menu_items;
drop policy if exists "Users can view their own menu items." on public.menu_items;
drop policy if exists "Users can manage their own clients." on public.clients;
drop policy if exists "Users can view their own clients." on public.clients;
drop policy if exists "Users can manage their own orders." on public.orders;
drop policy if exists "Users can view their own orders." on public.orders;


-- Create RLS policies
create policy "Users can view their own profile." on public.profiles for select
    using ( public.current_user_id() = id );
create policy "Users can insert their own profile." on public.profiles for insert
    with check ( public.current_user_id() = id );

create policy "Users can manage their own menu items." on public.menu_items for all
    using ( user_id = public.current_user_id() );
create policy "Users can view their own menu items." on public.menu_items for select
    using ( user_id = public.current_user_id() );

create policy "Users can manage their own clients." on public.clients for all
    using ( user_id = public.current_user_id() );
create policy "Users can view their own clients." on public.clients for select
    using ( user_id = public.current_user_id() );

create policy "Users can manage their own orders." on public.orders for all
    using ( user_id = public.current_user_id() );
create policy "Users can view their own orders." on public.orders for select
    using ( user_id = public.current_user_id() );


-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant execute on function public.handle_new_user() to supabase_auth_admin;

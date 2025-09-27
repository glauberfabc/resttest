-- Initial Schema

-- Create custom types
create type public.user_role as enum ('admin', 'collaborator');

-- Create tables
create table if not exists public.profiles (
    id uuid not null primary key,
    name text,
    email text,
    role user_role default 'collaborator'::public.user_role
);
alter table public.profiles add constraint fk_profiles_id foreign key (id) references auth.users(id) on delete cascade;

create table if not exists public.menu_items (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null,
    name text,
    description text,
    price numeric,
    category text,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text
);
alter table public.menu_items add constraint fk_menu_items_user_id foreign key (user_id) references auth.users(id) on delete cascade;

create table if not exists public.clients (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null,
    name text,
    phone text,
    document text
);
alter table public.clients add constraint fk_clients_user_id foreign key (user_id) references auth.users(id) on delete cascade;


-- Policies
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;

-- Drop dependent policies and the function itself to ensure a clean slate
drop function if exists public.authorizing_user_id() cascade;
drop function if exists public.get_user_id_from_claims() cascade;


-- Function to get user ID from JWT claims
create or replace function public.get_user_id_from_claims()
returns uuid
language sql stable
as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
$$;


-- Policies for profiles
create policy "Users can insert their own profile." on public.profiles for insert
    with check ( get_user_id_from_claims() = id );
create policy "Users can view their own profile." on public.profiles for select
    using ( get_user_id_from_claims() = id );
create policy "Users can update own profile." on public.profiles for update
    using ( get_user_id_from_claims() = id );

-- Policies for menu_items
create policy "Users can manage their own menu items." on public.menu_items for all
    using ( get_user_id_from_claims() = user_id );

-- Policies for clients
create policy "Users can manage their own clients." on public.clients for all
    using ( get_user_id_from_claims() = user_id );

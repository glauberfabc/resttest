
-- Drop policies and tables if they exist
drop policy if exists "Users can view their own profiles." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update their own profiles." on public.profiles;
drop policy if exists "Users can view their own menu items." on public.menu_items;
drop policy if exists "Users can insert their own menu items." on public.menu_items;
drop policy if exists "Users can update their own menu items." on public.menu_items;
drop policy if exists "Users can delete their own menu items." on public.menu_items;
drop policy if exists "Users can view their own clients." on public.clients;
drop policy if exists "Users can insert their own clients." on public.clients;
drop policy if exists "Users can update their own clients." on public.clients;
drop policy if exists "Users can delete their own clients." on public.clients;
drop policy if exists "Users can view their own orders." on public.orders;
drop policy if exists "Users can insert new orders." on public.orders;
drop policy if exists "Users can update their own orders." on public.orders;
drop policy if exists "Users can delete their own orders." on public.orders;
drop policy if exists "Users can manage their own order items." on public.order_items;
drop policy if exists "Users can manage their own order payments." on public.order_payments;
drop policy if exists "Admins can manage all product images." on storage.objects;
drop policy if exists "Anyone can view product images." on storage.objects;


drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

-- Drop trigger and function if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;
drop function if exists public.current_user_id;


--profiles
create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  email text not null,
  role text not null default 'collaborator'
);
alter table public.profiles enable row level security;


--menu_items
create table if not exists public.menu_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    user_id uuid not null references auth.users(id)
);
alter table public.menu_items enable row level security;

--clients
create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    document text,
    user_id uuid not null references auth.users(id)
);
alter table public.clients enable row level security;

--orders
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    type text not null, -- 'table' or 'name'
    identifier text not null,
    status text not null default 'open',
    created_at timestamptz not null default now(),
    paid_at timestamptz,
    user_id uuid not null references auth.users(id)
);
alter table public.orders enable row level security;

--order_items
create table if not exists public.order_items (
    order_id uuid not null references public.orders(id) on delete cascade,
    menu_item_id uuid not null references public.menu_items(id),
    quantity integer not null,
    primary key (order_id, menu_item_id)
);
alter table public.order_items enable row level security;

--order_payments
create table if not exists public.order_payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamptz not null default now()
);
alter table public.order_payments enable row level security;

-- Function to get current user id
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Function to create a profile for a new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
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

-- Trigger to call the function when a new user is created in auth
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Grant permissions for the trigger to work
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant usage on schema auth to postgres;
grant select on table auth.users to postgres;


-- RLS POLICIES

-- Profiles
create policy "Users can view their own profiles." on public.profiles for select
    using ( id = public.current_user_id() );
create policy "Users can insert their own profile." on public.profiles for insert
    with check ( id = public.current_user_id() );
create policy "Users can update their own profiles." on public.profiles for update
    using ( id = public.current_user_id() );

-- Menu Items
create policy "Users can view their own menu items." on public.menu_items for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert their own menu items." on public.menu_items for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their own menu items." on public.menu_items for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their own menu items." on public.menu_items for delete
    using ( user_id = public.current_user_id() );

-- Clients
create policy "Users can view their own clients." on public.clients for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert their own clients." on public.clients for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their own clients." on public.clients for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their own clients." on public.clients for delete
    using ( user_id = public.current_user_id() );

-- Orders
create policy "Users can view their own orders." on public.orders for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert new orders." on public.orders for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their own orders." on public.orders for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their own orders." on public.orders for delete
    using ( user_id = public.current_user_id() );

-- Order Items
create policy "Users can manage their own order items." on public.order_items
    for all using (
        order_id in (select id from public.orders where user_id = public.current_user_id())
    );

-- Order Payments
create policy "Users can manage their own order payments." on public.order_payments
    for all using (
        order_id in (select id from public.orders where user_id = public.current_user_id())
    );
    
-- Storage
create policy "Anyone can view product images." on storage.objects for select
    using ( bucket_id = 'menu-images' );

create policy "Admins can manage all product images." on storage.objects for all
    using (
        bucket_id = 'menu-images' and
        (select role from public.profiles where id = public.current_user_id()) = 'admin'
    ) with check (
        bucket_id = 'menu-images' and
        (select role from public.profiles where id = public.current_user_id()) = 'admin'
    );

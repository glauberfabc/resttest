-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  role text
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table public.profiles enable row level security;

-- Create a custom type for app roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        create type public.app_role as enum ('admin', 'collaborator');
    END IF;
END
$$;

-- Create a function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$;

-- trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Policies for profiles
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Policies for menu_items
alter table public.menu_items enable row level security;

drop policy if exists "Menu items are viewable by everyone." on public.menu_items;
create policy "Menu items are viewable by everyone."
  on public.menu_items for select
  using ( true );

drop policy if exists "Admins can do anything." on public.menu_items;
create policy "Admins can do anything."
  on public.menu_items for all
  using ( (select role from profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Collaborators can insert menu items." on public.menu_items;
create policy "Collaborators can insert menu items."
  on public.menu_items for insert
  with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
  
drop policy if exists "Collaborators can update menu items." on public.menu_items;
create policy "Collaborators can update menu items."
  on public.menu_items for update
  using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

-- Policies for clients
alter table public.clients enable row level security;

drop policy if exists "Clients are viewable by everyone." on public.clients;
create policy "Clients are viewable by everyone."
  on public.clients for select
  using ( true );

drop policy if exists "Admins can do anything." on public.clients;
create policy "Admins can do anything."
  on public.clients for all
  using ( (select role from profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Collaborators can insert clients." on public.clients;
create policy "Collaborators can insert clients."
  on public.clients for insert
  with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );

drop policy if exists "Collaborators can update clients." on public.clients;
create policy "Collaborators can update clients."
  on public.clients for update
  using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

-- Policies for orders
alter table public.orders enable row level security;

drop policy if exists "Orders are viewable by everyone." on public.orders;
create policy "Orders are viewable by everyone."
  on public.orders for select
  using ( true );

drop policy if exists "Admins can do anything." on public.orders;
create policy "Admins can do anything."
  on public.orders for all
  using ( (select role from profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Collaborators can insert orders." on public.orders;
create policy "Collaborators can insert orders."
  on public.orders for insert
  with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );

drop policy if exists "Collaborators can update orders." on public.orders;
create policy "Collaborators can update orders."
  on public.orders for update
  using ( (select role from profiles where id = auth.uid()) = 'collaborator' );


-- Policies for order_items
alter table public.order_items enable row level security;

drop policy if exists "Order items are viewable by everyone." on public.order_items;
create policy "Order items are viewable by everyone."
  on public.order_items for select
  using ( true );

drop policy if exists "Admins can do anything." on public.order_items;
create policy "Admins can do anything."
  on public.order_items for all
  using ( (select role from profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Collaborators can insert order items." on public.order_items;
create policy "Collaborators can insert order items."
  on public.order_items for insert
  with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );

drop policy if exists "Collaborators can update order items." on public.order_items;
create policy "Collaborators can update order items."
  on public.order_items for update
  using ( (select role from profiles where id = auth.uid()) = 'collaborator' );


-- Policies for payments
alter table public.payments enable row level security;

drop policy if exists "Payments are viewable by everyone." on public.payments;
create policy "Payments are viewable by everyone."
  on public.payments for select
  using ( true );

drop policy if exists "Admins can do anything." on public.payments;
create policy "Admins can do anything."
  on public.payments for all
  using ( (select role from profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Collaborators can insert payments." on public.payments;
create policy "Collaborators can insert payments."
  on public.payments for insert
  with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );

drop policy if exists "Collaborators can update payments." on public.payments;
create policy "Collaborators can update payments."
  on public.payments for update
  using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

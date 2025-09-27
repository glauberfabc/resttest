
-- Create a custom type for user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text,
  role app_role,
  primary key (id)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table public.profiles enable row level security;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- This trigger automatically creates a profile for new users.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data ->> 'name', 'collaborator');
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Policies for menu_items
alter table public.menu_items enable row level security;
DROP POLICY IF EXISTS "Allow all access for admins on menu_items" ON public.menu_items;
create policy "Allow all access for admins on menu_items" on public.menu_items for all using ( (select role from profiles where id = auth.uid()) = 'admin' );
DROP POLICY IF EXISTS "Allow read access for collaborators on menu_items" ON public.menu_items;
create policy "Allow read access for collaborators on menu_items" on public.menu_items for select using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow insert for collaborators on menu_items" ON public.menu_items;
create policy "Allow insert for collaborators on menu_items" on public.menu_items for insert with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow update for collaborators on menu_items" ON public.menu_items;
create policy "Allow update for collaborators on menu_items" on public.menu_items for update using ( (select role from profiles where id = auth.uid()) = 'collaborator' );


-- Policies for clients
alter table public.clients enable row level security;
DROP POLICY IF EXISTS "Allow all access for admins on clients" ON public.clients;
create policy "Allow all access for admins on clients" on public.clients for all using ( (select role from profiles where id = auth.uid()) = 'admin' );
DROP POLICY IF EXISTS "Allow read access for collaborators on clients" ON public.clients;
create policy "Allow read access for collaborators on clients" on public.clients for select using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow insert for collaborators on clients" ON public.clients;
create policy "Allow insert for collaborators on clients" on public.clients for insert with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow update for collaborators on clients" ON public.clients;
create policy "Allow update for collaborators on clients" on public.clients for update using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

-- Policies for orders
alter table public.orders enable row level security;
DROP POLICY IF EXISTS "Allow all access for admins on orders" ON public.orders;
create policy "Allow all access for admins on orders" on public.orders for all using ( (select role from profiles where id = auth.uid()) = 'admin' );
DROP POLICY IF EXISTS "Allow read access for collaborators on orders" ON public.orders;
create policy "Allow read access for collaborators on orders" on public.orders for select using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow insert for collaborators on orders" ON public.orders;
create policy "Allow insert for collaborators on orders" on public.orders for insert with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow update for collaborators on orders" ON public.orders;
create policy "Allow update for collaborators on orders" on public.orders for update using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

-- Policies for order_items
alter table public.order_items enable row level security;
DROP POLICY IF EXISTS "Allow all access for admins on order_items" ON public.order_items;
create policy "Allow all access for admins on order_items" on public.order_items for all using ( (select role from profiles where id = auth.uid()) = 'admin' );
DROP POLICY IF EXISTS "Allow read access for collaborators on order_items" ON public.order_items;
create policy "Allow read access for collaborators on order_items" on public.order_items for select using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow insert for collaborators on order_items" ON public.order_items;
create policy "Allow insert for collaborators on order_items" on public.order_items for insert with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow update for collaborators on order_items" ON public.order_items;
create policy "Allow update for collaborators on order_items" on public.order_items for update using ( (select role from profiles where id = auth.uid()) = 'collaborator' );

-- Policies for payments
alter table public.payments enable row level security;
DROP POLICY IF EXISTS "Allow all access for admins on payments" ON public.payments;
create policy "Allow all access for admins on payments" on public.payments for all using ( (select role from profiles where id = auth.uid()) = 'admin' );
DROP POLICY IF EXISTS "Allow read access for collaborators on payments" ON public.payments;
create policy "Allow read access for collaborators on payments" on public.payments for select using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow insert for collaborators on payments" ON public.payments;
create policy "Allow insert for collaborators on payments" on public.payments for insert with check ( (select role from profiles where id = auth.uid()) = 'collaborator' );
DROP POLICY IF EXISTS "Allow update for collaborators on payments" ON public.payments;
create policy "Allow update for collaborators on payments" on public.payments for update using ( (select role from profiles where id = auth.uid()) = 'collaborator' );
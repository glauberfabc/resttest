-- supabase/migrations/0001_rls_and_profiles.sql

-- 1. Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  full_name text,
  avatar_url text,
  role text default 'collaborator'
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'collaborator');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Function to check role
create or replace function public.get_user_role()
returns text as $$
begin
  return (
    select role from public.profiles where id = auth.uid()
  );
end;
$$ language plpgsql security invoker;


-- Enable RLS for all tables
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- Policies for menu_items
create policy "Allow all access for admin on menu_items"
on public.menu_items for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

create policy "Allow read access for collaborator on menu_items"
on public.menu_items for select
using (public.get_user_role() = 'collaborator');

create policy "Allow insert/update for collaborator on menu_items"
on public.menu_items for insert, update
using (public.get_user_role() = 'collaborator')
with check (public.get_user_role() = 'collaborator');

-- Policies for clients
create policy "Allow all access for admin on clients"
on public.clients for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

create policy "Allow read access for collaborator on clients"
on public.clients for select
using (public.get_user_role() = 'collaborator');

create policy "Allow insert/update for collaborator on clients"
on public.clients for insert, update
using (public.get_user_role() = 'collaborator')
with check (public.get_user_role() = 'collaborator');


-- Policies for orders
create policy "Allow all access for admin on orders"
on public.orders for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

create policy "Allow read access for collaborator on orders"
on public.orders for select
using (public.get_user_role() = 'collaborator');

create policy "Allow insert/update for collaborator on orders"
on public.orders for insert, update
using (public.get_user_role() = 'collaborator')
with check (public.get_user_role() = 'collaborator');


-- Policies for order_items
create policy "Allow all access for admin on order_items"
on public.order_items for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

create policy "Allow read access for collaborator on order_items"
on public.order_items for select
using (public.get_user_role() = 'collaborator');

create policy "Allow insert/update for collaborator on order_items"
on public.order_items for insert, update
using (public.get_user_role() = 'collaborator')
with check (public.get_user_role() = 'collaborator');


-- Policies for payments
create policy "Allow all access for admin on payments"
on public.payments for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

create policy "Allow read access for collaborator on payments"
on public.payments for select
using (public.get_user_role() = 'collaborator');

create policy "Allow insert/update for collaborator on payments"
on public.payments for insert, update
using (public.get_user_role() = 'collaborator')
with check (public.get_user_role() = 'collaborator');

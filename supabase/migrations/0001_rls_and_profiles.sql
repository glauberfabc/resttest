-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text,
  role text,
  primary key (id)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table public.profiles enable row level security;

-- Add a new type for user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END$$;


-- This trigger automatically creates a profile for new users.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists, then create it
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS for all tables
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- Policies for profiles
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile." on public.profiles;
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select using (auth.uid() = id);

-- Policies for menu_items
drop policy if exists "Allow all access for admin" on public.menu_items;
create policy "Allow all access for admin" on public.menu_items for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
drop policy if exists "Allow read access for collaborators" on public.menu_items;
create policy "Allow read access for collaborators" on public.menu_items for select using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow insert for collaborators" on public.menu_items;
create policy "Allow insert for collaborators" on public.menu_items for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow update for collaborators" on public.menu_items;
create policy "Allow update for collaborators" on public.menu_items for update using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);

-- Policies for clients
drop policy if exists "Allow all access for admin" on public.clients;
create policy "Allow all access for admin" on public.clients for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
drop policy if exists "Allow read access for collaborators" on public.clients;
create policy "Allow read access for collaborators" on public.clients for select using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow insert for collaborators" on public.clients;
create policy "Allow insert for collaborators" on public.clients for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow update for collaborators" on public.clients;
create policy "Allow update for collaborators" on public.clients for update using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);

-- Policies for orders
drop policy if exists "Allow all access for admin" on public.orders;
create policy "Allow all access for admin" on public.orders for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
drop policy if exists "Allow read access for collaborators" on public.orders;
create policy "Allow read access for collaborators" on public.orders for select using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow insert for collaborators" on public.orders;
create policy "Allow insert for collaborators" on public.orders for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow update for collaborators" on public.orders;
create policy "Allow update for collaborators" on public.orders for update using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);

-- Policies for order_items
drop policy if exists "Allow all access for admin" on public.order_items;
create policy "Allow all access for admin" on public.order_items for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
drop policy if exists "Allow read access for collaborators" on public.order_items;
create policy "Allow read access for collaborators" on public.order_items for select using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow insert for collaborators" on public.order_items;
create policy "Allow insert for collaborators" on public.order_items for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow update for collaborators" on public.order_items;
create policy "Allow update for collaborators" on public.order_items for update using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);

-- Policies for payments
drop policy if exists "Allow all access for admin" on public.payments;
create policy "Allow all access for admin" on public.payments for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
drop policy if exists "Allow read access for collaborators" on public.payments;
create policy "Allow read access for collaborators" on public.payments for select using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow insert for collaborators" on public.payments;
create policy "Allow insert for collaborators" on public.payments for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);
drop policy if exists "Allow update for collaborators" on public.payments;
create policy "Allow update for collaborators" on public.payments for update using (
  (select role from public.profiles where id = auth.uid()) = 'collaborator'
);

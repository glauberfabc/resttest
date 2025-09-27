-- 1. Create app_role type
create type app_role as enum ('admin', 'collaborator');

-- 2. Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  role app_role default 'collaborator'
);
-- This table will be publicly accessible
alter table profiles enable row level security;

-- 3. Set up a trigger to create a profile for each new user
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Helper functions for RLS
create function check_if_user_is_admin()
returns boolean as $$
begin
  return exists (
    select 1
    from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  );
end;
$$ language plpgsql security definer;

create function check_if_user_is_collaborator()
returns boolean as $$
begin
  return exists (
    select 1
    from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  );
end;
$$ language plpgsql security definer;


-- 5. Enable RLS for all tables
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- 6. RLS Policies

-- profiles
create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Admins can read all profiles"
on public.profiles for select
using (check_if_user_is_admin());

-- menu_items
create policy "Admins can manage menu items"
on public.menu_items for all
using (check_if_user_is_admin());

create policy "Collaborators can read menu items"
on public.menu_items for select
using (auth.role() = 'authenticated');

create policy "Collaborators can create menu items"
on public.menu_items for insert
with check (check_if_user_is_collaborator());

create policy "Collaborators can update menu items"
on public.menu_items for update
using (check_if_user_is_collaborator());


-- clients
create policy "Admins can manage clients"
on public.clients for all
using (check_if_user_is_admin());

create policy "Collaborators can read clients"
on public.clients for select
using (auth.role() = 'authenticated');

create policy "Collaborators can create clients"
on public.clients for insert
with check (check_if_user_is_collaborator());

create policy "Collaborators can update clients"
on public.clients for update
using (check_if_user_is_collaborator());

-- orders
create policy "Admins can manage orders"
on public.orders for all
using (check_if_user_is_admin());

create policy "Collaborators can read orders"
on public.orders for select
using (auth.role() = 'authenticated');

create policy "Collaborators can create orders"
on public.orders for insert
with check (check_if_user_is_collaborator());

create policy "Collaborators can update orders"
on public.orders for update
using (check_if_user_is_collaborator());


-- order_items
create policy "Admins can manage order items"
on public.order_items for all
using (check_if_user_is_admin());

create policy "Collaborators can read order items"
on public.order_items for select
using (auth.role() = 'authenticated');

create policy "Collaborators can create order items"
on public.order_items for insert
with check (check_if_user_is_collaborator());

create policy "Collaborators can update order items"
on public.order_items for update
using (check_if_user_is_collaborator());


-- payments
create policy "Admins can manage payments"
on public.payments for all
using (check_if_user_is_admin());

create policy "Collaborators can read payments"
on public.payments for select
using (auth.role() = 'authenticated');

create policy "Collaborators can create payments"
on public.payments for insert
with check (check_if_user_is_collaborator());

create policy "Collaborators can update payments"
on public.payments for update
using (check_if_user_is_collaborator());

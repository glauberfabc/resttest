
-- 1. Create an ENUM for app roles
create type app_role as enum ('admin', 'collaborator');

-- 2. Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  role app_role default 'collaborator'
);

-- 3. Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 4. Create a trigger to create a profile for new users
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RLS for menu_items
alter table menu_items enable row level security;
grant select on menu_items to authenticated;
create policy "Admins can manage menu items" on public.menu_items for all using (get_my_claim('role') = 'admin'::text) with check (get_my_claim('role') = 'admin'::text);
create policy "Collaborators can view and create/update menu items" on public.menu_items for select using (true);
create policy "Collaborators can create menu items" on public.menu_items for insert with check (get_my_claim('role') = 'collaborator'::text);
create policy "Collaborators can update menu items" on public.menu_items for update with check (get_my_claim('role') = 'collaborator'::text);


-- 6. RLS for clients
alter table clients enable row level security;
grant select on clients to authenticated;
create policy "Admins can manage clients" on public.clients for all using (get_my_claim('role') = 'admin'::text) with check (get_my_claim('role') = 'admin'::text);
create policy "Collaborators can view and create/update clients" on public.clients for select using (true);
create policy "Collaborators can create clients" on public.clients for insert with check (get_my_claim('role') = 'collaborator'::text);
create policy "Collaborators can update clients" on public.clients for update with check (get_my_claim('role') = 'collaborator'::text);

-- 7. RLS for orders
alter table orders enable row level security;
grant select on orders to authenticated;
create policy "Admins can manage orders" on public.orders for all using (get_my_claim('role') = 'admin'::text) with check (get_my_claim('role') = 'admin'::text);
create policy "Collaborators can view and create/update orders" on public.orders for select using (true);
create policy "Collaborators can create orders" on public.orders for insert with check (get_my_claim('role') = 'collaborator'::text);
create policy "Collaborators can update orders" on public.orders for update with check (get_my_claim('role') = 'collaborator'::text);

-- 8. RLS for order_items
alter table order_items enable row level security;
grant select on order_items to authenticated;
create policy "Admins can manage order_items" on public.order_items for all using (get_my_claim('role') = 'admin'::text) with check (get_my_claim('role') = 'admin'::text);
create policy "Collaborators can view and create/update order_items" on public.order_items for select using (true);
create policy "Collaborators can create order_items" on public.order_items for insert with check (get_my_claim('role') = 'collaborator'::text);
create policy "Collaborators can update order_items" on public.order_items for update with check (get_my_claim('role') = 'collaborator'::text);

-- 9. RLS for payments
alter table payments enable row level security;
grant select on payments to authenticated;
create policy "Admins can manage payments" on public.payments for all using (get_my_claim('role') = 'admin'::text) with check (get_my_claim('role') = 'admin'::text);
create policy "Collaborators can view and create/update payments" on public.payments for select using (true);
create policy "Collaborators can create payments" on public.payments for insert with check (get_my_claim('role') = 'collaborator'::text);
create policy "Collaborators can update payments" on public.payments for update with check (get_my_claim('role') = 'collaborator'::text);

-- 10. Enable access for authenticated users
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

-- Function to get user role from custom claims
create or replace function get_my_claim(claim text)
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> claim,
    (select nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'user_metadata' ->> claim)
  )::text
$$;

create policy "Authenticated users can view their own profile" on public.profiles
  for select
  using ( auth.uid() = id );

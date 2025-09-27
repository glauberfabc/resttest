-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  name text not null,
  role app_role not null default 'collaborator'
);

alter table profiles
  enable row level security;

-- Add RLS policies for profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);


-- This trigger automatically creates a profile for new users.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', (new.raw_user_meta_data->>'role')::app_role);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Menu Items RLS
alter table public.menu_items enable row level security;

create policy "Allow read access to menu_items for all authenticated users"
on public.menu_items for select
to authenticated
using (true);

create policy "Allow admins to manage menu_items"
on public.menu_items for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Allow collaborators to insert menu_items"
on public.menu_items for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

create policy "Allow collaborators to update menu_items"
on public.menu_items for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);


-- Clients RLS
alter table public.clients enable row level security;

create policy "Allow read access to clients for all authenticated users"
on public.clients for select
to authenticated
using (true);

create policy "Allow admins to manage clients"
on public.clients for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Allow collaborators to insert clients"
on public.clients for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

create policy "Allow collaborators to update clients"
on public.clients for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

-- Orders RLS
alter table public.orders enable row level security;

create policy "Allow read access to orders for all authenticated users"
on public.orders for select
to authenticated
using (true);

create policy "Allow admins to manage orders"
on public.orders for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Allow collaborators to insert orders"
on public.orders for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

create policy "Allow collaborators to update orders"
on public.orders for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);


-- Order Items RLS
alter table public.order_items enable row level security;

create policy "Allow read access to order_items for all authenticated users"
on public.order_items for select
to authenticated
using (true);

create policy "Allow admins to manage order_items"
on public.order_items for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Allow collaborators to insert order_items"
on public.order_items for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

create policy "Allow collaborators to update order_items"
on public.order_items for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);


-- Payments RLS
alter table public.payments enable row level security;

create policy "Allow read access to payments for all authenticated users"
on public.payments for select
to authenticated
using (true);

create policy "Allow admins to manage payments"
on public.payments for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Allow collaborators to insert payments"
on public.payments for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

create policy "Allow collaborators to update payments"
on public.payments for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'collaborator'
  )
);

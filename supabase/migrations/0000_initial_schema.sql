
-- Drop existing objects to ensure a clean slate
drop policy if exists "Allow authenticated users to upload" on storage.objects;
drop policy if exists "Allow authenticated users to read" on storage.objects;
drop policy if exists "Give users access to their own folder" on storage.objects;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

drop table if exists public.order_payments;
drop table if exists public.order_items;
drop table if exists public.orders;
drop table if exists public.menu_items;
drop table if exists public.clients;
drop table if exists public.profiles;


-- Create profiles table
create table public.profiles (
  id uuid not null primary key,
  name text,
  role text default 'collaborator'
);
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- Create clients table
create table public.clients (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null,
  name text not null,
  phone text,
  document text,
  created_at timestamp with time zone not null default now()
);
alter table public.clients add constraint clients_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- Create menu_items table
create table public.menu_items (
    id uuid not null primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    created_at timestamp with time zone not null default now()
);

-- Create orders table
create table public.orders (
    id uuid not null primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,
    identifier text not null,
    status text not null default 'open',
    created_at timestamp with time zone not null default now(),
    paid_at timestamp with time zone
);

-- Create order_items table
create table public.order_items (
    order_id uuid not null references public.orders(id) on delete cascade,
    menu_item_id uuid not null references public.menu_items(id) on delete cascade,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

-- Create order_payments table
create table public.order_payments (
    id uuid not null primary key default uuid_generate_v4(),
    order_id uuid not null references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamp with time zone not null default now()
);

-- Function to create a profile for a new user
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

-- Trigger to call the function when a new user is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Row Level Security (RLS) Policies

-- Policies for profiles
alter table profiles enable row level security;
create policy "Users can view their own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

-- Policies for clients
alter table clients enable row level security;
create policy "Users can view their own clients" on clients for select using (auth.uid() = user_id);
create policy "Users can insert their own clients" on clients for insert with check (auth.uid() = user_id);
create policy "Users can update their own clients" on clients for update using (auth.uid() = user_id);
create policy "Users can delete their own clients" on clients for delete using (auth.uid() = user_id);

-- Policies for menu_items
alter table menu_items enable row level security;
create policy "Menu items are viewable by everyone" on menu_items for select using (true);
create policy "Users can insert their own menu items" on menu_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own menu items" on menu_items for update using (auth.uid() = user_id);
create policy "Users can delete their own menu items" on menu_items for delete using (auth.uid() = user_id);

-- Policies for orders
alter table orders enable row level security;
create policy "Users can view their own orders" on orders for select using (auth.uid() = user_id);
create policy "Users can insert their own orders" on orders for insert with check (auth.uid() = user_id);
create policy "Users can update their own orders" on orders for update using (auth.uid() = user_id);
create policy "Users can delete their own orders" on orders for delete using (auth.uid() = user_id);

-- Policies for order_items
alter table order_items enable row level security;
create policy "Users can manage items on their own orders" on order_items for all
    using (exists(select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

-- Policies for order_payments
alter table order_payments enable row level security;
create policy "Users can manage payments on their own orders" on order_payments for all
    using (exists(select 1 from orders where orders.id = order_payments.order_id and orders.user_id = auth.uid()));

-- Storage Policies for 'menu-images' bucket
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "Allow public read access to menu images" on storage.objects
  for select using ( bucket_id = 'menu-images' );

create policy "Allow authenticated users to upload menu images" on storage.objects
  for insert with check ( bucket_id = 'menu-images' and auth.role() = 'authenticated' );
  
create policy "Allow authenticated users to update their own menu images" on storage.objects
    for update using ( bucket_id = 'menu-images' and auth.uid() = owner );

create policy "Allow authenticated users to delete their own menu images" on storage.objects
    for delete using ( bucket_id = 'menu-images' and auth.uid() = owner );


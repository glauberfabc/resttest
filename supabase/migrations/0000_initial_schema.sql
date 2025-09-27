-- Create a table for public profiles
create table if not exists profiles (
  id uuid not null references auth.users on delete cascade,
  name text,
  role text default 'collaborator',
  primary key (id)
);
-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table profiles
  enable row level security;

-- Policies for profiles
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for menu items
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text
);

alter table menu_items enable row level security;

drop policy if exists "Menu items are viewable by authenticated users." on menu_items;
create policy "Menu items are viewable by authenticated users." on menu_items for select to authenticated using (true);

drop policy if exists "Admins can manage menu items." on menu_items;
create policy "Admins can manage menu items." on menu_items for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
) with check (
  (select role from profiles where id = auth.uid()) = 'admin'
);


-- This trigger automatically creates a profile for new users.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
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


-- Set up storage security for profile images
-- Create a bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;


-- Policies for storage
drop policy if exists "Product images are publicly accessible." on storage.objects;
create policy "Product images are publicly accessible." on storage.objects for select using ( bucket_id = 'product-images' );

drop policy if exists "Authenticated users can upload product images." on storage.objects;
create policy "Authenticated users can upload product images." on storage.objects for insert to authenticated with check ( bucket_id = 'product-images' );

drop policy if exists "Authenticated users can update their own product images." on storage.objects;
create policy "Authenticated users can update their own product images." on storage.objects for update to authenticated using ( auth.uid() = owner_id );

drop policy if exists "Authenticated users can delete their own product images." on storage.objects;
create policy "Authenticated users can delete their own product images." on storage.objects for delete to authenticated using ( auth.uid() = owner_id );

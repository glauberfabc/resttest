-- Create custom types
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
  role app_role default 'collaborator',
  primary key (id)
);
alter table public.profiles enable row level security;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "System can delete profiles." ON public.profiles;
CREATE POLICY "System can delete profiles." ON public.profiles FOR DELETE USING (auth.role() = 'supabase_auth_admin');


-- Create a table for menu items
create table if not exists public.menu_items (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid references auth.users not null default auth.uid(),
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text
);
alter table public.menu_items enable row level security;
DROP POLICY IF EXISTS "Users can view their own menu items." ON public.menu_items;
CREATE POLICY "Users can view their own menu items." ON public.menu_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own menu items." ON public.menu_items;
CREATE POLICY "Users can insert their own menu items." ON public.menu_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own menu items." ON public.menu_items;
CREATE POLICY "Users can update their own menu items." ON public.menu_items FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own menu items." ON public.menu_items;
CREATE POLICY "Users can delete their own menu items." ON public.menu_items FOR DELETE USING (auth.uid() = user_id);


-- Set up Realtime!
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.menu_items;


-- Set up Storage!
insert into storage.buckets (id, name, public)
values ('product_images', 'product_images', false)
on conflict (id) do nothing;

DROP POLICY IF EXISTS "Authenticated users can select product images" ON storage.objects;
CREATE POLICY "Authenticated users can select product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can insert product images" ON storage.objects;
CREATE POLICY "Authenticated users can insert product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);


-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is important!
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'collaborator');
  RETURN NEW;
END;
$$;

-- Trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

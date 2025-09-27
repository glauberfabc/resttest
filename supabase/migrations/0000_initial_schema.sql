-- Create custom types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY references auth.users(id) on delete cascade,
    name text,
    role public.app_role NOT NULL DEFAULT 'collaborator'
);
comment on table public.profiles is 'Profile data for each user.';
comment on column public.profiles.id is 'References the internal Supabase auth user.';

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price real not null,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade
);
comment on table public.menu_items is 'Menu items for the restaurant.';

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "System can delete profiles." ON public.profiles;
CREATE POLICY "System can delete profiles." ON public.profiles FOR DELETE USING (auth.role() = 'supabase_auth_admin');


-- Policies for menu_items
DROP POLICY IF EXISTS "Users can view all menu items." ON public.menu_items;
CREATE POLICY "Users can view all menu items." ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage their own menu items." ON public.menu_items;
CREATE POLICY "Authenticated users can manage their own menu items." ON public.menu_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create a bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
DROP POLICY IF EXISTS "Authenticated users can view product images" ON storage.objects;
CREATE POLICY "Authenticated users can view product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "Authenticated users can insert product images" ON storage.objects;
CREATE POLICY "Authenticated users can insert product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can update their own product images" ON storage.objects;
CREATE POLICY "Authenticated users can update their own product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can delete their own product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product_images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    'collaborator'
  );
  RETURN NEW;
END;
$$;

-- Trigger to call the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a custom type for user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END$$;


-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  role app_role DEFAULT 'collaborator'
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "System and users can delete profiles." ON public.profiles;
CREATE POLICY "System and users can delete profiles." ON public.profiles FOR DELETE USING (auth.uid() = id OR auth.role() = 'supabase_auth_admin');


-- This trigger automatically creates a profile for new users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies for menu_items table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Menu items are viewable by everyone." ON public.menu_items;
CREATE POLICY "Menu items are viewable by everyone." ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and collaborators can insert menu items." ON public.menu_items;
CREATE POLICY "Admins and collaborators can insert menu items." ON public.menu_items FOR INSERT WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Admins and collaborators can update menu items." ON public.menu_items;
CREATE POLICY "Admins and collaborators can update menu items." ON public.menu_items FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Admins and collaborators can delete menu items." ON public.menu_items;
CREATE POLICY "Admins and collaborators can delete menu items." ON public.menu_items FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

-- Policies for product_images bucket
DROP POLICY IF EXISTS "Anyone can view product images." ON storage.objects;
CREATE POLICY "Anyone can view product images." ON storage.objects FOR SELECT USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "Authenticated users can upload product images." ON storage.objects;
CREATE POLICY "Authenticated users can upload product images." ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Authenticated users can update their product images." ON storage.objects;
CREATE POLICY "Authenticated users can update their product images." ON storage.objects FOR UPDATE USING (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Authenticated users can delete their product images." ON storage.objects;
CREATE POLICY "Authenticated users can delete their product images." ON storage.objects FOR DELETE USING (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

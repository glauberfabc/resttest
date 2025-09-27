-- Create custom types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- USERS
-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text,
  role app_role NOT NULL DEFAULT 'collaborator',
  PRIMARY KEY (id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- This trigger automatically creates a profile for new users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- MENU ITEMS
-- Enable RLS for menu_items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Add policies for menu_items
DROP POLICY IF EXISTS "Menu items are viewable by everyone." ON public.menu_items;
CREATE POLICY "Menu items are viewable by everyone." ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert menu items." ON public.menu_items;
CREATE POLICY "Admins can insert menu items." ON public.menu_items FOR INSERT WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins or collaborators can update menu items." ON public.menu_items;
CREATE POLICY "Admins or collaborators can update menu items." ON public.menu_items FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Admins can delete menu items." ON public.menu_items;
CREATE POLICY "Admins can delete menu items." ON public.menu_items FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);


-- BUCKET FOR PRODUCT IMAGES
-- Create a bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Add policies for product_images bucket
DROP POLICY IF EXISTS "Product images are publicly viewable." ON storage.objects;
CREATE POLICY "Product images are publicly viewable." ON storage.objects FOR SELECT USING ( bucket_id = 'product_images' );

DROP POLICY IF EXISTS "Anyone authenticated can upload a product image." ON storage.objects;
CREATE POLICY "Anyone authenticated can upload a product image." ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'product_images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Admins or collaborators can update product images." ON storage.objects;
CREATE POLICY "Admins or collaborators can update product images." ON storage.objects FOR UPDATE USING (
    bucket_id = 'product_images' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS "Admins or collaborators can delete product images." ON storage.objects;
CREATE POLICY "Admins or collaborators can delete product images." ON storage.objects FOR DELETE USING (
    bucket_id = 'product_images' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

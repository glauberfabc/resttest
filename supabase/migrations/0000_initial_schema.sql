-- Create custom types
CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');

-- USERS
-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role public.app_role NOT NULL DEFAULT 'collaborator',
  PRIMARY KEY (id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- Allow individual users to view their own profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- TRIGGERS
-- This trigger automatically creates a profile for new users
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


-- STORAGE
-- Create a bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- POLICIES for storage
-- Allow anyone to view images in the product_images bucket
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
CREATE POLICY "Allow public read access to product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product_images');

-- Allow authenticated users with admin/collaborator role to upload images
DROP POLICY IF EXISTS "Allow admin/collaborator to upload product images" ON storage.objects;
CREATE POLICY "Allow admin/collaborator to upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product_images' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
  );

-- Allow authenticated users with admin/collaborator role to update images
DROP POLICY IF EXISTS "Allow admin/collaborator to update product images" ON storage.objects;
CREATE POLICY "Allow admin/collaborator to update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product_images' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
  );

-- Allow authenticated users with admin/collaborator role to delete images
DROP POLICY IF EXISTS "Allow admin/collaborator to delete product images" ON storage.objects;
CREATE POLICY "Allow admin/collaborator to delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product_images' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
  );

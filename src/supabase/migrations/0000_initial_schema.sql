-- Create app_role type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    role app_role DEFAULT 'collaborator'::app_role NOT NULL
);

-- Set up Row Level Security (RLS) for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage any profile." ON public.profiles;
CREATE POLICY "Admins can manage any profile." ON public.profiles FOR ALL
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- Function to handle new user creation and populate profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  RETURN new;
END;
$$;

-- Trigger to call the function when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    description text,
    price numeric(10, 2) NOT NULL,
    category text,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS for menu_items table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view menu items." ON public.menu_items;
CREATE POLICY "Authenticated users can view menu items." ON public.menu_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage menu items." ON public.menu_items;
CREATE POLICY "Admins can manage menu items." ON public.menu_items FOR ALL
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Create 'product-images' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage objects in 'product-images' bucket
DROP POLICY IF EXISTS "Authenticated users can view product images." ON storage.objects;
CREATE POLICY "Authenticated users can view product images." ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can insert product images." ON storage.objects;
CREATE POLICY "Authenticated users can insert product images." ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can update product images." ON storage.objects;
CREATE POLICY "Admins can update product images." ON storage.objects
    FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can delete product images." ON storage.objects;
CREATE POLICY "Admins can delete product images." ON storage.objects
    FOR DELETE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

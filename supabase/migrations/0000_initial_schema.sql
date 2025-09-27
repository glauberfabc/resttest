-- Create app_role type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    name character varying,
    role public.app_role NOT NULL DEFAULT 'collaborator'::public.app_role
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.profiles IS 'Profile data for each user.';

-- Create menu_items table with user_id
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    name character varying NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category character varying,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.menu_items IS 'Menu items for the establishment.';

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    name character varying NOT NULL,
    phone character varying,
    document character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.clients IS 'Client registration.';

-- Trigger function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'admin');
  RETURN new;
END;
$$;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies for profiles table
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can do anything" ON public.profiles;
CREATE POLICY "Admins can do anything" ON public.profiles FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Policies for menu_items table
DROP POLICY IF EXISTS "Authenticated users can see all menu items" ON public.menu_items;
CREATE POLICY "Authenticated users can see all menu items" ON public.menu_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own menu items" ON public.menu_items;
CREATE POLICY "Users can insert their own menu items" ON public.menu_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own menu items" ON public.menu_items;
CREATE POLICY "Users can update their own menu items" ON public.menu_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own menu items" ON public.menu_items;
CREATE POLICY "Users can delete their own menu items" ON public.menu_items FOR DELETE USING (auth.uid() = user_id);

-- Policies for clients table
DROP POLICY IF EXISTS "Authenticated users can see all clients" ON public.clients;
CREATE POLICY "Authenticated users can see all clients" ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- Create product_images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product_images', 'product_images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies for storage (product_images bucket)
DROP POLICY IF EXISTS "Authenticated can select images" ON storage.objects;
CREATE POLICY "Authenticated can select images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "Authenticated can insert images" ON storage.objects;
CREATE POLICY "Authenticated can insert images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product_images' and auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated can update their own images" ON storage.objects;
CREATE POLICY "Authenticated can update their own images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product_images' and auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated can delete their own images" ON storage.objects;
CREATE POLICY "Authenticated can delete their own images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product_images' and auth.uid()::text = (storage.foldername(name))[1]);

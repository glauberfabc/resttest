-- Create app_role type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    role app_role NOT NULL DEFAULT 'collaborator'
);

-- Create menu_items table with user_id
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer default 0,
    low_stock_threshold integer default 0,
    unit text default 'un',
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

-- Create clients table with user_id
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    name text not null,
    phone text,
    document text,
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROPPOLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can select product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policies for menu_items
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for clients
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- Create trigger function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is crucial
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to call the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Set up Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Authenticated users can select product images"
    ON storage.objects FOR SELECT
    TO authenticated
    USING ((bucket_id = 'product_images' AND (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "Authenticated users can insert product images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ((bucket_id = 'product_images' AND (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "Authenticated users can update product images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ((bucket_id = 'product_images' AND (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "Authenticated users can delete product images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ((bucket_id = 'product_images' AND (storage.foldername(name))[1] = auth.uid()::text));

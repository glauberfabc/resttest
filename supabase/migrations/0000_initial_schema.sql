-- Drop dependent objects first
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

-- Drop the function with CASCADE to remove any other lingering dependencies
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

-- Drop tables with CASCADE to ensure all dependencies are removed
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Recreate tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY,
    name text,
    role text DEFAULT 'collaborator'::text,
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    name text,
    description text,
    price real,
    category text,
    "imageUrl" text,
    stock integer,
    "lowStockThreshold" integer,
    unit text,
    CONSTRAINT menu_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    name text,
    phone text,
    document text,
    CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Secure function to get user ID from JWT
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;


-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;


-- Policies for profiles
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT
    WITH CHECK ( current_user_id() = id );
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT
    USING ( current_user_id() = id );
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE
    USING ( current_user_id() = id );

-- Policies for menu_items
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL
    USING ( current_user_id() = user_id );

-- Policies for clients
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL
    USING ( current_user_id() = user_id );

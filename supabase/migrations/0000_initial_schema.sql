-- Drop existing objects in reverse order of dependency to avoid errors
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.profiles;


-- Recreate tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'collaborator',
    email TEXT,
    CONSTRAINT id_fk FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit TEXT,
    user_id UUID NOT NULL,
    CONSTRAINT user_id_fk FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    document TEXT,
    user_id UUID NOT NULL,
    CONSTRAINT user_id_fk FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Secure function to get user ID from JWT claims
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;


-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;


-- Recreate policies using the secure function
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT
    WITH CHECK ( current_user_id() = id );

CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT
    USING ( current_user_id() = id );

CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE
    USING ( current_user_id() = id );

CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL
    USING ( current_user_id() = user_id )
    WITH CHECK ( current_user_id() = user_id );

CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL
    USING ( current_user_id() = user_id )
    WITH CHECK ( current_user_id() = user_id );

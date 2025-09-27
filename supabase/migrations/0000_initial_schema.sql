-- supabase/migrations/0000_initial_schema.sql

-- Drop dependent objects first in the correct order or use CASCADE
-- Drop policies that depend on the function first
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Allow all for admin users" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated users to read" ON public.menu_items;
DROP POLICY IF EXISTS "Allow all for admin users" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated users to read" ON public.clients;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.clients;

-- Now, drop the function. Using CASCADE is a more robust way to handle this.
DROP FUNCTION IF EXISTS public.authorizing_user_id() CASCADE;

-- Create a function to safely get the user's ID from the JWT claims
create or replace function public.authorizing_user_id()
returns uuid
language sql stable
security definer
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Create tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'collaborator'
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100),
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit VARCHAR(50),
    user_id UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    document VARCHAR(20),
    user_id UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
create policy "Users can insert their own profile." on public.profiles for insert with check ( authorizing_user_id() = id );
create policy "Users can view their own profile." on public.profiles for select using ( authorizing_user_id() = id );
create policy "Users can update own profile." on public.profiles for update using ( authorizing_user_id() = id );

-- Create policies for menu_items
CREATE POLICY "Allow all for admin users" ON public.menu_items FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = authorizing_user_id()) = 'admin'
);
CREATE POLICY "Allow authenticated users to read" ON public.menu_items FOR SELECT USING (auth.role() = 'authenticated');

-- Create policies for clients
CREATE POLICY "Allow all for admin users" ON public.clients FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = authorizing_user_id()) = 'admin'
);
CREATE POLICY "Allow authenticated users to read" ON public.clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');

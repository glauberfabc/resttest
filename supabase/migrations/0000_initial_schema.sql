-- Drop existing objects in reverse order of creation, using CASCADE for dependencies.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.current_user_id();

DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;


-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  updated_at timestamp with time zone NULL,
  name character varying NULL,
  role text NOT NULL DEFAULT 'collaborator'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
-- comments
COMMENT ON TABLE public.profiles IS 'Stores user-profiles and their associated roles.';

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT menu_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
-- comments
COMMENT ON TABLE public.menu_items IS 'Stores the menu items for the restaurant.';

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  document text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
-- comments
COMMENT ON TABLE public.clients IS 'Stores client information for orders.';


-- Secure the tables with Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Function to get the current user's ID from JWT claims
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
COMMENT ON FUNCTION public.current_user_id() IS 'Returns the user ID from the JWT claims.';

--
-- Policies for 'profiles' table
--
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT
  USING (current_user_id() = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT
  WITH CHECK (current_user_id() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE
  USING (current_user_id() = id)
  WITH CHECK (current_user_id() = id);

--
-- Policies for 'menu_items' table
--
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL
  USING (current_user_id() = user_id)
  WITH CHECK (current_user_id() = user_id);

--
-- Policies for 'clients' table
--
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL
  USING (current_user_id() = user_id)
  WITH CHECK (current_user_id() = user_id);

--
-- Function to handle new user creation
--
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'name',
    'collaborator'
  );
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create a profile for a new user.';


--
-- Trigger to execute the function on new user sign-up
--
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Seed initial data for storage policies (optional, but good practice)
-- This ensures that even if you have storage policies, they don't block profile creation.
-- In this specific case, we are not adding storage policies yet, but this is where they would go.

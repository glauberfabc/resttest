-- Create the app_role type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    role app_role NOT NULL DEFAULT 'collaborator'
);

-- Function to get a claim from the JWT
create or replace function get_my_claim(claim_name text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> claim_name, '')::text;
$$;

-- Function to get the user role
create or replace function get_my_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return (select role from profiles where id = auth.uid())::text;
end;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    (NEW.raw_user_meta_data->>'role')::app_role
  );
  -- Set the user's role in the custom claims
  PERFORM set_custom_claim(NEW.id, 'user_role', (NEW.raw_user_meta_data->>'role'));
  RETURN NEW;
END;
$$;

-- Trigger to call handle_new_user on new user sign up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Enable RLS for the tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything" ON public.profiles;
DROP POLICY IF EXISTS "Allow collaborators to insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow collaborators to update" ON public.profiles;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can do anything" ON public.menu_items;
DROP POLICY IF EXISTS "Collaborators can insert" ON public.menu_items;
DROP POLICY IF EXISTS "Collaborators can update" ON public.menu_items;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.clients;
DROP POLICY IF EXISTS "Admins can do anything" ON public.clients;
DROP POLICY IF EXISTS "Collaborators can insert" ON public.clients;
DROP POLICY IF EXISTS "Collaborators can update" ON public.clients;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Admins can do anything" ON public.orders;
DROP POLICY IF EXISTS "Collaborators can insert" ON public.orders;
DROP POLICY IF EXISTS "Collaborators can update" ON public.orders;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.order_items;
DROP POLICY IF EXISTS "Admins can do anything" ON public.order_items;
DROP POLICY IF EXISTS "Collaborators can insert" ON public.order_items;
DROP POLICY IF EXISTS "Collaborators can update" ON public.order_items;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;
DROP POLICY IF EXISTS "Admins can do anything" ON public.payments;
DROP POLICY IF EXISTS "Collaborators can insert" ON public.payments;
DROP POLICY IF EXISTS "Collaborators can update" ON public.payments;

-- Create Policies for PROFILES
CREATE POLICY "Allow authenticated users to read their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Admins can do anything" ON public.profiles
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Allow collaborators to insert" ON public.profiles
  FOR INSERT WITH CHECK (get_my_role() = 'collaborator');

CREATE POLICY "Allow collaborators to update" ON public.profiles
  FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');


-- Create Policies for MENU_ITEMS
CREATE POLICY "Enable read access for all users" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins can do anything" ON public.menu_items FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Collaborators can insert" ON public.menu_items FOR INSERT WITH CHECK (get_my_role() = 'collaborator');
CREATE POLICY "Collaborators can update" ON public.menu_items FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');

-- Create Policies for CLIENTS
CREATE POLICY "Enable read access for all users" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Admins can do anything" ON public.clients FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Collaborators can insert" ON public.clients FOR INSERT WITH CHECK (get_my_role() = 'collaborator');
CREATE POLICY "Collaborators can update" ON public.clients FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');

-- Create Policies for ORDERS
CREATE POLICY "Enable read access for all users" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Admins can do anything" ON public.orders FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Collaborators can insert" ON public.orders FOR INSERT WITH CHECK (get_my_role() = 'collaborator');
CREATE POLICY "Collaborators can update" ON public.orders FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');

-- Create Policies for ORDER_ITEMS
CREATE POLICY "Enable read access for all users" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Admins can do anything" ON public.order_items FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Collaborators can insert" ON public.order_items FOR INSERT WITH CHECK (get_my_role() = 'collaborator');
CREATE POLICY "Collaborators can update" ON public.order_items FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');

-- Create Policies for PAYMENTS
CREATE POLICY "Enable read access for all users" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Admins can do anything" ON public.payments FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Collaborators can insert" ON public.payments FOR INSERT WITH CHECK (get_my_role() = 'collaborator');
CREATE POLICY "Collaborators can update" ON public.payments FOR UPDATE USING (get_my_role() = 'collaborator') WITH CHECK (get_my_role() = 'collaborator');

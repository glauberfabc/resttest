-- Create a custom type for user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
    END IF;
END
$$;

-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  role app_role default 'collaborator'
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function after a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Policies for menu_items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.menu_items;
CREATE POLICY "Allow read access for authenticated users" ON public.menu_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for collaborators" ON public.menu_items;
CREATE POLICY "Allow insert for collaborators" ON public.menu_items FOR INSERT TO authenticated WITH CHECK ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow update for collaborators" ON public.menu_items;
CREATE POLICY "Allow update for collaborators" ON public.menu_items FOR UPDATE TO authenticated USING ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow delete for admins" ON public.menu_items;
CREATE POLICY "Allow delete for admins" ON public.menu_items FOR DELETE TO authenticated USING ( (get_user_role() = 'admin'::app_role) );

-- Policies for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.clients;
CREATE POLICY "Allow read access for authenticated users" ON public.clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for collaborators" ON public.clients;
CREATE POLICY "Allow insert for collaborators" ON public.clients FOR INSERT TO authenticated WITH CHECK ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow update for collaborators" ON public.clients;
CREATE POLICY "Allow update for collaborators" ON public.clients FOR UPDATE TO authenticated USING ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow delete for admins" ON public.clients;
CREATE POLICY "Allow delete for admins" ON public.clients FOR DELETE TO authenticated USING ( (get_user_role() = 'admin'::app_role) );

-- Policies for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.orders;
CREATE POLICY "Allow read access for authenticated users" ON public.orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for collaborators" ON public.orders;
CREATE POLICY "Allow insert for collaborators" ON public.orders FOR INSERT TO authenticated WITH CHECK ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow update for collaborators" ON public.orders;
CREATE POLICY "Allow update for collaborators" ON public.orders FOR UPDATE TO authenticated USING ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow delete for admins" ON public.orders;
CREATE POLICY "Allow delete for admins" ON public.orders FOR DELETE TO authenticated USING ( (get_user_role() = 'admin'::app_role) );

-- Policies for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.order_items;
CREATE POLICY "Allow read access for authenticated users" ON public.order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for collaborators" ON public.order_items;
CREATE POLICY "Allow insert for collaborators" ON public.order_items FOR INSERT TO authenticated WITH CHECK ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow update for collaborators" ON public.order_items;
CREATE POLICY "Allow update for collaborators" ON public.order_items FOR UPDATE TO authenticated USING ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow delete for admins" ON public.order_items;
CREATE POLICY "Allow delete for admins" ON public.order_items FOR DELETE TO authenticated USING ( (get_user_role() = 'admin'::app_role) );

-- Policies for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.payments;
CREATE POLICY "Allow read access for authenticated users" ON public.payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for collaborators" ON public.payments;
CREATE POLICY "Allow insert for collaborators" ON public.payments FOR INSERT TO authenticated WITH CHECK ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow update for collaborators" ON public.payments;
CREATE POLICY "Allow update for collaborators" ON public.payments FOR UPDATE TO authenticated USING ( (get_user_role() = 'admin'::app_role) OR (get_user_role() = 'collaborator'::app_role) );
DROP POLICY IF EXISTS "Allow delete for admins" ON public.payments;
CREATE POLICY "Allow delete for admins" ON public.payments FOR DELETE TO authenticated USING ( (get_user_role() = 'admin'::app_role) );

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role AS $$
DECLARE
  user_role app_role;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql;

-- Create a custom type for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');

-- Create a table for public profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role public.app_role NOT NULL DEFAULT 'collaborator',
  PRIMARY KEY (id)
);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', 'collaborator');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  category text,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admins" ON public.menu_items;
CREATE POLICY "Allow all access to admins" ON public.menu_items FOR ALL USING (public.is_claims_admin());
DROP POLICY IF EXISTS "Allow read access to collaborators" ON public.menu_items;
CREATE POLICY "Allow read access to collaborators" ON public.menu_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert access to collaborators" ON public.menu_items;
CREATE POLICY "Allow insert access to collaborators" ON public.menu_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to collaborators" ON public.menu_items;
CREATE POLICY "Allow update access to collaborators" ON public.menu_items FOR UPDATE USING (true);

-- Create clients table
CREATE TABLE public.clients (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  phone text,
  document text
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admins" ON public.clients;
CREATE POLICY "Allow all access to admins" ON public.clients FOR ALL USING (public.is_claims_admin());
DROP POLICY IF EXISTS "Allow read access to collaborators" ON public.clients;
CREATE POLICY "Allow read access to collaborators" ON public.clients FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert access to collaborators" ON public.clients;
CREATE POLICY "Allow insert access to collaborators" ON public.clients FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to collaborators" ON public.clients;
CREATE POLICY "Allow update access to collaborators" ON public.clients FOR UPDATE USING (true);

-- Create orders table
CREATE TABLE public.orders (
  id text NOT NULL PRIMARY KEY,
  type text NOT NULL,
  identifier text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  paid_at timestamptz
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admins" ON public.orders;
CREATE POLICY "Allow all access to admins" ON public.orders FOR ALL USING (public.is_claims_admin());
DROP POLICY IF EXISTS "Allow read access to collaborators" ON public.orders;
CREATE POLICY "Allow read access to collaborators" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert access to collaborators" ON public.orders;
CREATE POLICY "Allow insert access to collaborators" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to collaborators" ON public.orders;
CREATE POLICY "Allow update access to collaborators" ON public.orders FOR UPDATE USING (true);

-- Create order_items table
CREATE TABLE public.order_items (
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id text NOT NULL REFERENCES public.menu_items(id),
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, menu_item_id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admins" ON public.order_items;
CREATE POLICY "Allow all access to admins" ON public.order_items FOR ALL USING (public.is_claims_admin());
DROP POLICY IF EXISTS "Allow read access to collaborators" ON public.order_items;
CREATE POLICY "Allow read access to collaborators" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert access to collaborators" ON public.order_items;
CREATE POLICY "Allow insert access to collaborators" ON public.order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to collaborators" ON public.order_items;
CREATE POLICY "Allow update access to collaborators" ON public.order_items FOR UPDATE USING (true);


-- Create payments table
CREATE TABLE public.payments (
  id serial PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL,
  paid_at timestamptz NOT NULL
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admins" ON public.payments;
CREATE POLICY "Allow all access to admins" ON public.payments FOR ALL USING (public.is_claims_admin());
DROP POLICY IF EXISTS "Allow read access to collaborators" ON public.payments;
CREATE POLICY "Allow read access to collaborators" ON public.payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert access to collaborators" ON public.payments;
CREATE POLICY "Allow insert access to collaborators" ON public.payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to collaborators" ON public.payments;
CREATE POLICY "Allow update access to collaborators" ON public.payments FOR UPDATE USING (true);


-- Create Storage Bucket for Product Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING ( bucket_id = 'product_images' );

DROP POLICY IF EXISTS "Allow insert for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow insert for admins and collaborators" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'product_images' AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.app_role OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'collaborator'::public.app_role
  )
);

DROP POLICY IF EXISTS "Allow update for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow update for admins and collaborators" ON storage.objects FOR UPDATE USING (
  bucket_id = 'product_images' AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.app_role OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'collaborator'::public.app_role
  )
);

DROP POLICY IF EXISTS "Allow delete for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow delete for admins and collaborators" ON storage.objects FOR DELETE USING (
  bucket_id = 'product_images' AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.app_role OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'collaborator'::public.app_role
  )
);

-- Drop dependent objects first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables if they exist
DROP TABLE IF EXISTS public.order_payments;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.profiles;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'collaborator'))
);

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    document VARCHAR(50)
);

-- Create menu_items table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100),
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit VARCHAR(50)
);

-- Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('table', 'name')),
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paying', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

-- Create order_items table
CREATE TABLE public.order_items (
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);

-- Create order_payments table
CREATE TABLE public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'collaborator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for clients
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for menu_items
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view all menu items." ON public.menu_items;
CREATE POLICY "Authenticated users can view all menu items." ON public.menu_items FOR SELECT
  USING (auth.role() = 'authenticated');


-- RLS Policies for orders
DROP POLICY IF EXISTS "Users can manage their own orders." ON public.orders;
CREATE POLICY "Users can manage their own orders." ON public.orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Users can manage items in their own orders." ON public.order_items;
CREATE POLICY "Users can manage items in their own orders." ON public.order_items FOR ALL
  USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
  );

-- RLS Policies for order_payments
DROP POLICY IF EXISTS "Users can manage payments for their own orders." ON public.order_payments;
CREATE POLICY "Users can manage payments for their own orders." ON public.order_payments FOR ALL
  USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
  );

-- Allow public access to storage bucket for menu images
-- This assumes a bucket named 'menu-images' exists.
-- The UI for creating the bucket is in the Supabase dashboard.
CREATE POLICY "Public read access for menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

CREATE POLICY "Users can upload their own menu images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

CREATE POLICY "Users can update their own menu images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'menu-images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );
  
CREATE POLICY "Users can delete their own menu images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'menu-images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

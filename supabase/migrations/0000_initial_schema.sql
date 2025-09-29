-- Drop existing policies and tables to ensure a clean slate
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.menu_items;
DROP POLICY IF EXISTS "Users can manage their own menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can manage their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can manage their own order payments" ON public.order_payments;
DROP POLICY IF EXISTS "Allow authenticated users to upload images." ON storage.objects;
DROP POLICY IF EXISTS "Give users access to their own images." ON storage.objects;

-- Drop tables in reverse order of creation due to foreign key constraints
DROP TABLE IF EXISTS public.order_payments;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.profiles;

-- Create profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    name character varying,
    role text CHECK (role IN ('admin', 'collaborator')) NOT NULL DEFAULT 'collaborator'::text
);

-- Create clients table
CREATE TABLE public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    name character varying NOT NULL,
    phone character varying,
    document character varying
);

-- Create menu_items table
CREATE TABLE public.menu_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category character varying,
    image_url character varying,
    stock integer,
    low_stock_threshold integer,
    unit character varying
);

-- Create orders table
CREATE TABLE public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    type character varying NOT NULL,
    identifier character varying NOT NULL,
    status character varying NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    paid_at timestamp with time zone
);

-- Create order_items table
CREATE TABLE public.order_items (
    order_id uuid NOT NULL REFERENCES public.orders ON DELETE CASCADE,
    menu_item_id uuid NOT NULL REFERENCES public.menu_items ON DELETE CASCADE,
    quantity integer NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);

-- Create order_payments table
CREATE TABLE public.order_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES public.orders ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    method character varying NOT NULL,
    paid_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Create Policies for profiles
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create Policies for menu_items
CREATE POLICY "Enable read access for all users" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Users can manage their own menu items" ON public.menu_items FOR ALL USING (auth.uid() = user_id);

-- Create Policies for clients
CREATE POLICY "Users can manage their own clients" ON public.clients FOR ALL USING (auth.uid() = user_id);

-- Create Policies for orders
CREATE POLICY "Users can manage their own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);

-- Create Policies for order_items
CREATE POLICY "Users can manage their own order items" ON public.order_items FOR ALL USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
);

-- Create Policies for order_payments
CREATE POLICY "Users can manage their own order payments" ON public.order_payments FOR ALL USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
);


-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create menu-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Allow authenticated users to upload images." ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "Give users access to their own images." ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'menu-images' AND owner = auth.uid());

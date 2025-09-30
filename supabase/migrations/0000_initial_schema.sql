-- Drop dependent objects first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables
DROP TABLE IF EXISTS public.order_payments;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.profiles;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'collaborator'
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    document VARCHAR(50)
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create order_items table
CREATE TABLE public.order_items (
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create order_payments table
CREATE TABLE public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(50),
    paid_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;


-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'collaborator');
  RETURN NEW;
END;
$$;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Policies for profiles
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for clients
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL USING (auth.uid() = user_id);

-- Policies for menu_items
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Allow public read access to menu items" ON public.menu_items FOR SELECT USING (true);


-- Policies for orders
CREATE POLICY "Users can manage their own orders." ON public.orders FOR ALL USING (auth.uid() = user_id);

-- Policies for order_items
CREATE POLICY "Users can manage items in their own orders." ON public.order_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    ));

-- Policies for order_payments
CREATE POLICY "Users can manage payments for their own orders." ON public.order_payments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.orders WHERE orders.id = order_payments.order_id AND orders.user_id = auth.uid()
    ));

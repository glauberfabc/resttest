-- Drop existing objects in reverse order of dependency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop policies
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admin users can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Admin users can manage all menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can view menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admin users can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin users can manage all order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can manage their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admin users can manage all order payments" ON public.order_payments;
DROP POLICY IF EXISTS "Users can manage their own order payments" ON public.order_payments;

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
    role VARCHAR(50) DEFAULT 'collaborator',
    email VARCHAR(255)
);
COMMENT ON TABLE public.profiles IS 'Stores user profile information.';

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    document VARCHAR(20)
);
COMMENT ON TABLE public.clients IS 'Stores client information for orders.';

-- Create menu_items table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(50),
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit VARCHAR(10)
);
COMMENT ON TABLE public.menu_items IS 'Stores all menu items available.';

-- Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'table' or 'name'
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);
COMMENT ON TABLE public.orders IS 'Represents a single order/check.';

-- Create order_items table
CREATE TABLE public.order_items (
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);
COMMENT ON TABLE public.order_items IS 'Junction table for items within an order.';

-- Create order_payments table
CREATE TABLE public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.order_payments IS 'Stores payment transactions for an order.';

/******************
* HELPER FUNCTIONS
******************/

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'collaborator', NEW.email);
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile for a new user.';

/******************
* TRIGGERS
******************/

-- Trigger to execute handle_new_user on new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/******************
* RLS POLICIES
******************/

-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Clients policies
CREATE POLICY "Admin users can manage all clients" ON public.clients FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING (user_id = auth.uid());

-- Menu items policies
CREATE POLICY "Admin users can manage all menu items" ON public.menu_items FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Authenticated users can view menu items" ON public.menu_items FOR SELECT USING (auth.role() = 'authenticated');

-- Orders policies
CREATE POLICY "Admin users can manage all orders" ON public.orders FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own orders" ON public.orders FOR DELETE USING (user_id = auth.uid());

-- Order items policies
CREATE POLICY "Admin users can manage all order items" ON public.order_items FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can manage their own order items" ON public.order_items FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
);

-- Order payments policies
CREATE POLICY "Admin users can manage all order payments" ON public.order_payments FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Users can manage their own order payments" ON public.order_payments FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
);

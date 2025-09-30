
-- Drop existing objects in reverse order of dependency
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.clients;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.clients;
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.menu_items;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.menu_items;
DROP POLICY- IF EXISTS "Enable all access for admin users" ON public.orders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.order_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.order_items;
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.order_payments;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.order_payments;


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
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'collaborator'
);
COMMENT ON TABLE public.profiles IS 'Stores user profile information.';

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    document TEXT
);
COMMENT ON TABLE public.clients IS 'Stores client information.';

-- Create menu_items table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    stock INT,
    low_stock_threshold INT,
    unit TEXT
);
COMMENT ON TABLE public.menu_items IS 'Stores menu items.';

-- Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    identifier TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);
COMMENT ON TABLE public.orders IS 'Stores order information.';

-- Create order_items table
CREATE TABLE public.order_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL,
    UNIQUE(order_id, menu_item_id)
);
COMMENT ON TABLE public.order_items IS 'Stores items within an order.';

-- Create order_payments table
CREATE TABLE public.order_payments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.order_payments IS 'Stores payment details for orders.';


-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile." ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile." ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable all access for admin users" ON public.profiles
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for clients table
CREATE POLICY "Enable all access for admin users" ON public.clients
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
    
CREATE POLICY "Enable read access for all authenticated users" ON public.clients
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for menu_items table
CREATE POLICY "Enable all access for admin users" ON public.menu_items
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Enable read access for all authenticated users" ON public.menu_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for orders table
CREATE POLICY "Enable all access for admin users" ON public.orders
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Enable all access for authenticated users" ON public.orders
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for order_items table
CREATE POLICY "Enable all access for admin users" ON public.order_items
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Enable all access for authenticated users" ON public.order_items
    FOR ALL USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()));

-- RLS Policies for order_payments table
CREATE POLICY "Enable all access for admin users" ON public.order_payments
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Enable all access for authenticated users" ON public.order_payments
    FOR ALL USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()));

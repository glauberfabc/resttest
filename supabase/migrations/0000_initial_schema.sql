-- Drop trigger and function if they exist from previous failed attempts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Drop tables in reverse order of creation to handle dependencies
DROP TABLE IF EXISTS public.order_payments;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.profiles;

-- Create profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying,
    role character varying DEFAULT 'collaborator'::character varying
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    phone character varying,
    document character varying
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create menu_items table
CREATE TABLE public.menu_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category character varying,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit character varying
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type character varying NOT NULL,
    identifier character varying NOT NULL,
    status character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create order_items table
CREATE TABLE public.order_items (
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity integer NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create order_payments table
CREATE TABLE public.order_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    method character varying NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES --

-- Profiles Policies
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete their own profile." ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Clients Policies
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL USING (auth.uid() = user_id);

-- Menu Items Policies
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL USING (auth.uid() = user_id);

-- Orders Policies
CREATE POLICY "Users can manage their own orders." ON public.orders FOR ALL USING (auth.uid() = user_id);

-- Order Items Policies
CREATE POLICY "Users can manage items in their own orders." ON public.order_items FOR ALL
    USING ( (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid() );

-- Order Payments Policies
CREATE POLICY "Users can manage payments for their own orders." ON public.order_payments FOR ALL
    USING ( (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid() );

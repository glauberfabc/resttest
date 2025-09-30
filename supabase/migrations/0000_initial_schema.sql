
-- Drop existing objects in reverse order of dependency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.clients;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.menu_items;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.order_items;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.order_payments;

DROP FUNCTION IF EXISTS auth.handle_new_user();

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
    phone VARCHAR(20),
    document VARCHAR(20)
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

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
    unit VARCHAR(20)
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
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
    method VARCHAR(50) NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;


-- Function to create a profile for a new user, in the correct schema
create or replace function auth.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$;

-- Trigger to execute the function after a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure auth.handle_new_user();


-- RLS Policies
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable all operations for authenticated users" ON public.clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Enable all operations for authenticated users" ON public.menu_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Enable all operations for authenticated users" ON public.orders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Enable all operations for authenticated users" ON public.order_items FOR ALL USING (
    (EXISTS ( SELECT 1 FROM orders WHERE (orders.id = order_items.order_id)))
);
CREATE POLICY "Enable all operations for authenticated users" ON public.order_payments FOR ALL USING (
    (EXISTS ( SELECT 1 FROM orders WHERE (orders.id = order_payments.order_id)))
);


-- Set up storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, '{"image/*"}')
on conflict (id) do nothing;

create policy "Enable public access to all menu images"
on storage.objects for select
to public
using ( bucket_id = 'menu-images' );

create policy "Enable insert for authenticated users"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'menu-images' AND auth.uid() = owner_id );

create policy "Enable update for authenticated users"
on storage.objects for update
to authenticated
using ( auth.uid() = owner_id );

create policy "Enable delete for authenticated users"
on storage.objects for delete
to authenticated
using ( auth.uid() = owner_id );

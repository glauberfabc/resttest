
-- Apaga tudo para garantir um estado limpo. A ordem é importante para evitar erros de dependência.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;
DROP TABLE IF EXISTS public.order_payments;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.profiles;


-- 1. Tabela de Perfis de Usuário
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'collaborator'
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Clientes
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    document VARCHAR(50),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de Itens do Cardápio
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit VARCHAR(20),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- 4. Tabela de Comandas
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'table' ou 'name'
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. Tabela de Itens da Comanda (Tabela de Junção)
CREATE TABLE public.order_items (
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, menu_item_id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 6. Tabela de Pagamentos da Comanda
CREATE TABLE public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Função para criar um perfil quando um novo usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'admin'); -- Define o primeiro usuário como admin
  RETURN new;
END;
$$;

-- Gatilho para executar a função handle_new_user a cada novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Políticas de Segurança (RLS)

-- 1. Profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- 2. Clients
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
CREATE POLICY "Users can manage their own clients." ON public.clients FOR ALL USING (auth.uid() = user_id);

-- 3. Menu Items
DROP POLICY IF EXISTS "Users can manage their own menu items." ON public.menu_items;
CREATE POLICY "Users can manage their own menu items." ON public.menu_items FOR ALL USING (auth.uid() = user_id);

-- 4. Orders
DROP POLICY IF EXISTS "Users can manage their own orders." ON public.orders;
CREATE POLICY "Users can manage their own orders." ON public.orders FOR ALL USING (auth.uid() = user_id);

-- 5. Order Items
DROP POLICY IF EXISTS "Users can manage items in their own orders." ON public.order_items;
CREATE POLICY "Users can manage items in their own orders." ON public.order_items FOR ALL USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
);

-- 6. Order Payments
DROP POLICY IF EXISTS "Users can manage payments for their own orders." ON public.order_payments;
CREATE POLICY "Users can manage payments for their own orders." ON public.order_payments FOR ALL USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
);

-- Habilita a leitura para usuários autenticados em tabelas de dados principais.
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.clients;
CREATE POLICY "Allow authenticated read access" ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.menu_items;
CREATE POLICY "Allow authenticated read access" ON public.menu_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.orders;
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.order_items;
CREATE POLICY "Allow authenticated read access" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.order_payments;
CREATE POLICY "Allow authenticated read access" ON public.order_payments FOR SELECT TO authenticated USING (true);


-- Configuração de Armazenamento (Storage)

-- 1. Cria o bucket para imagens do cardápio, se ainda não existir.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Acesso para o Bucket 'menu-images'

-- Permite que qualquer pessoa veja as imagens (essencial para exibi-las no app)
DROP POLICY IF EXISTS "Allow public read access to menu images" ON storage.objects;
CREATE POLICY "Allow public read access to menu images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'menu-images' );

-- Permite que usuários autenticados enviem (insert) imagens para seu próprio diretório
DROP POLICY IF EXISTS "Allow authenticated users to upload to their folder" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'menu-images' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Permite que usuários autenticados atualizem (update) suas próprias imagens
DROP POLICY IF EXISTS "Allow authenticated users to update their own images" ON storage.objects;
CREATE POLICY "Allow authenticated users to update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'menu-images' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Permite que usuários autenticados apaguem (delete) suas próprias imagens
DROP POLICY IF EXISTS "Allow authenticated users to delete their own images" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'menu-images' AND (storage.foldername(name))[1] = auth.uid()::text );


-- Tabela para os itens do cardápio (menu)
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    stock INTEGER,
    low_stock_threshold INTEGER,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para os clientes
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    document TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para as comandas (pedidos)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('table', 'name')),
    identifier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paying', 'paid')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTamptz,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL
);

-- Tabela de junção para os itens dentro de uma comanda
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time NUMERIC(10, 2) NOT NULL, -- Preço do item no momento da compra
    UNIQUE (order_id, menu_item_id)
);

-- Tabela para os pagamentos de uma comanda
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method TEXT NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funções para atualizar o campo `updated_at` automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para `menu_items`
CREATE TRIGGER set_menu_items_timestamp
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Triggers para `clients`
CREATE TRIGGER set_clients_timestamp
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

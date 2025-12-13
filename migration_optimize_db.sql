-- Adiciona coluna de saldo na tabela de clientes
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- Função para calcular o saldo de um cliente específico
CREATE OR REPLACE FUNCTION public.calculate_client_balance(target_client_id UUID) RETURNS VOID AS $$
DECLARE
    client_name TEXT;
    total_credits NUMERIC;
    total_debt NUMERIC;
BEGIN
    -- Obter o nome do cliente
    SELECT name INTO client_name FROM public.clients WHERE id = target_client_id;
    
    IF client_name IS NULL THEN
        RETURN;
    END IF;

    -- Somar créditos
    SELECT COALESCE(SUM(amount), 0) INTO total_credits
    FROM public.client_credits
    WHERE client_id = target_client_id;

    -- Somar Dívida Pendente (Total das Comandas - Pagamentos) para comandas ABERTAS/PAGANDO
    SELECT COALESCE(SUM(
        (SELECT COALESCE(SUM(oi.quantity * mi.price), 0)
         FROM public.order_items oi
         JOIN public.menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = o.id)
        -
        (SELECT COALESCE(SUM(op.amount), 0)
         FROM public.order_payments op
         WHERE op.order_id = o.id)
    ), 0) INTO total_debt
    FROM public.orders o
    WHERE o.type = 'name' 
      AND UPPER(o.identifier) = UPPER(client_name)
      AND o.status != 'paid';

    -- Atualizar cliente
    UPDATE public.clients
    SET balance = total_credits - total_debt
    WHERE id = target_client_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para client_credits
CREATE OR REPLACE FUNCTION public.trigger_update_balance_credits() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.calculate_client_balance(OLD.client_id);
    ELSE
        PERFORM public.calculate_client_balance(NEW.client_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balance_on_credit_change ON public.client_credits;
CREATE TRIGGER update_balance_on_credit_change
AFTER INSERT OR UPDATE OR DELETE ON public.client_credits
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_balance_credits();

-- Helper para encontrar client_id a partir de uma comanda
CREATE OR REPLACE FUNCTION public.get_client_id_from_order(order_rec public.orders) RETURNS UUID AS $$
DECLARE
    c_id UUID;
BEGIN
    IF order_rec.type = 'name' THEN
        SELECT id INTO c_id FROM public.clients WHERE UPPER(name) = UPPER(order_rec.identifier) LIMIT 1;
        RETURN c_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Orders
CREATE OR REPLACE FUNCTION public.trigger_update_balance_orders() RETURNS TRIGGER AS $$
DECLARE
    cid UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        cid := public.get_client_id_from_order(OLD);
        IF cid IS NOT NULL THEN PERFORM public.calculate_client_balance(cid); END IF;
    ELSE
        cid := public.get_client_id_from_order(NEW);
        IF cid IS NOT NULL THEN PERFORM public.calculate_client_balance(cid); END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balance_on_order_change ON public.orders;
CREATE TRIGGER update_balance_on_order_change
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_balance_orders();

-- Trigger para Order Items
CREATE OR REPLACE FUNCTION public.trigger_update_balance_items() RETURNS TRIGGER AS $$
DECLARE
    ord public.orders%ROWTYPE;
    cid UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        SELECT * INTO ord FROM public.orders WHERE id = OLD.order_id;
    ELSE
        SELECT * INTO ord FROM public.orders WHERE id = NEW.order_id;
    END IF;
    
    cid := public.get_client_id_from_order(ord);
    IF cid IS NOT NULL THEN PERFORM public.calculate_client_balance(cid); END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balance_on_item_change ON public.order_items;
CREATE TRIGGER update_balance_on_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_balance_items();

-- Trigger para Order Payments
CREATE OR REPLACE FUNCTION public.trigger_update_balance_payments() RETURNS TRIGGER AS $$
DECLARE
    ord public.orders%ROWTYPE;
    cid UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        SELECT * INTO ord FROM public.orders WHERE id = OLD.order_id;
    ELSE
        SELECT * INTO ord FROM public.orders WHERE id = NEW.order_id;
    END IF;
    
    cid := public.get_client_id_from_order(ord);
    IF cid IS NOT NULL THEN PERFORM public.calculate_client_balance(cid); END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balance_on_payment_change ON public.order_payments;
CREATE TRIGGER update_balance_on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_balance_payments();

-- Cálculo Inicial de Saldos
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN SELECT id FROM public.clients LOOP
        PERFORM public.calculate_client_balance(c.id);
    END LOOP;
END;
$$;

-- Update RLS policies to allow all authenticated users to see all orders, regardless of who created them.

-- 1. Orders Table
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Everyone can view all orders" ON public.orders
FOR SELECT TO authenticated USING (true);

-- 2. Order Items Table
DROP POLICY IF EXISTS "Users can manage items on their own orders" ON public.order_items;
CREATE POLICY "Everyone can view all order items" ON public.order_items
FOR SELECT TO authenticated USING (true);

-- Note: Keep management policies restricted if needed, but for viewing we open it up.
CREATE POLICY "Users can manage items on their own orders" ON public.order_items
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
);

-- 3. Order Payments Table
DROP POLICY IF EXISTS "Users can manage payments on their own orders" ON public.order_payments;
CREATE POLICY "Everyone can view all order payments" ON public.order_payments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage payments on their own orders" ON public.order_payments
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_payments.order_id 
        AND (orders.user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_orders_identifier ON public.orders(identifier);

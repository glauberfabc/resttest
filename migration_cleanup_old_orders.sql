-- Função para limpar comandas pagas antigas (mais de 4 meses)
-- Para rodar manualmente: SELECT cleanup_old_orders();
-- Para agendar (necessita pg_cron): SELECT cron.schedule('0 5 * * *', 'SELECT cleanup_old_orders()');

CREATE OR REPLACE FUNCTION cleanup_old_orders() 
RETURNS void AS $$
BEGIN
  -- 1. Deletar ITENS de pedidos antigos pagos
  DELETE FROM order_items 
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE status = 'paid' 
    AND (
        paid_at < NOW() - INTERVAL '4 months' 
        OR (paid_at IS NULL AND created_at < NOW() - INTERVAL '4 months')
    )
  );

  -- 2. Deletar PAGAMENTOS de pedidos antigos pagos
  DELETE FROM order_payments 
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE status = 'paid' 
    AND (
        paid_at < NOW() - INTERVAL '4 months' 
        OR (paid_at IS NULL AND created_at < NOW() - INTERVAL '4 months')
    )
  );

  -- 3. Deletar os PEDIDOS antigos pagos
  DELETE FROM orders 
  WHERE status = 'paid' 
  AND (
      paid_at < NOW() - INTERVAL '4 months' 
      OR (paid_at IS NULL AND created_at < NOW() - INTERVAL '4 months')
  );
END;
$$ LANGUAGE plpgsql;

-- Este arquivo contém os comandos SQL necessários para habilitar as atualizações em tempo real (Realtime) do Supabase
-- para as tabelas utilizadas no sistema de comandas.
--
-- Para aplicar, copie e cole o conteúdo deste arquivo no Editor SQL do seu projeto Supabase e clique em "RUN".
--
-- Documentação de referência: https://supabase.com/docs/guides/realtime/postgres-changes

-- Habilita o tempo real para a tabela de comandas (orders)
-- Isso notificará o app quando uma comanda for criada, atualizada ou excluída.
alter publication supabase_realtime add table orders;

-- Habilita o tempo real para a tabela de itens da comanda (order_items)
-- Isso notificará o app quando itens forem adicionados, removidos ou atualizados em uma comanda.
alter publication supabase_realtime add table order_items;

-- Habilita o tempo real para a tabela de pagamentos (order_payments)
-- Isso notificará o app quando um pagamento for registrado em uma comanda.
alter publication supabase_realtime add table order_payments;

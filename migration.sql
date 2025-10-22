-- Este comando SQL adiciona a coluna 'customer_name' à tabela 'orders'.
-- Copie e execute este comando no editor SQL do seu painel Supabase
-- para atualizar a estrutura do seu banco de dados.

ALTER TABLE public.orders
ADD COLUMN customer_name TEXT;

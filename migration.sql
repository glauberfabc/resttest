-- Adiciona a coluna de nome do cliente (opcional) na tabela de comandas
ALTER TABLE public.orders
ADD COLUMN customer_name TEXT;

-- Adiciona a coluna de email na tabela de perfis
ALTER TABLE public.profiles
ADD COLUMN email TEXT UNIQUE;

-- Atualiza os emails existentes dos perfis com base na tabela de usuários do Supabase Auth
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

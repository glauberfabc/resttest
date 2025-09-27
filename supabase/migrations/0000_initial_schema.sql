-- Apaga tabelas antigas se existirem, junto com todas as dependências (CASCADE)
drop table if exists public.profiles cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.orders cascade;
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;

-- Remove o trigger e a função se existirem para garantir um estado limpo
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Remove políticas de segurança de armazenamento se existirem
drop policy if exists "Admins can manage all storage" on storage.objects;

-- Remove o usuário admin antigo, se existir, para permitir a recriação limpa
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@comandazap.com') THEN
      DELETE FROM auth.users WHERE email = 'admin@comandazap.com';
   END IF;
END $$;

-- Cria a tabela de perfis de usuário
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'collaborator'
);

-- Cria a tabela de itens do cardápio
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Cria a tabela de clientes
create table public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    document text,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Cria a tabela de comandas
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    identifier text not null,
    status text not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    paid_at timestamp with time zone
);

-- Cria a tabela de itens da comanda (tabela de junção)
create table public.order_items (
    order_id uuid references public.orders(id) on delete cascade,
    menu_item_id uuid references public.menu_items(id) on delete cascade,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

-- Cria a tabela de pagamentos da comanda
create table public.order_payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Função helper para obter o ID do usuário autenticado
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

-- 1. Cria a função que será acionada pelo trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Novo Usuário'),
    new.email,
    'collaborator'
  );
  return new;
end;
$$;

-- 2. Cria o trigger que chama a função após um novo usuário ser criado
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Ativa RLS para todas as tabelas
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table storage.objects enable row level security;


-- Políticas de segurança para a tabela de perfis
create policy "Users can view their own profile." on public.profiles for select
    using ( id = public.current_user_id() );
create policy "Users can update their own profile." on public.profiles for update
    using ( id = public.current_user_id() );

-- Políticas de segurança para as outras tabelas
create policy "Users can manage their own data." on public.menu_items
    for all using ( user_id = public.current_user_id() );
create policy "Users can manage their own data." on public.clients
    for all using ( user_id = public.current_user_id() );
create policy "Users can manage their own data." on public.orders
    for all using ( user_id = public.current_user_id() );
create policy "Users can manage their own data." on public.order_items
    for all using ( order_id in (select id from public.orders where user_id = public.current_user_id()) );
create policy "Users can manage their own data." on public.order_payments
    for all using ( order_id in (select id from public.orders where user_id = public.current_user_id()) );

-- Políticas de segurança para o Storage
create policy "Admins can manage all storage" on storage.objects
    for all using (
        bucket_id = 'menu-images' and (select role from public.profiles where id = auth.uid()) = 'admin'
    ) with check (
        bucket_id = 'menu-images' and (select role from public.profiles where id = auth.uid()) = 'admin'
    );
create policy "Collaborators can manage their own images" on storage.objects
    for all using (
        bucket_id = 'menu-images' and owner = auth.uid()
    ) with check (
        bucket_id = 'menu-images' and owner = auth.uid()
    );


-- INSERIR DADOS INICIAIS
-- Cria o usuário admin e seu perfil
DO $$
DECLARE
    admin_id uuid;
BEGIN
    -- Insere o usuário no sistema de autenticação do Supabase
    admin_id := '9c57d2ce-949e-4fa0-9cc6-175a823545e4'; -- UUID estático para consistência
    
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_sent_at, confirmed_at)
    VALUES (
        admin_id,
        'authenticated',
        'authenticated',
        'admin@comandazap.com',
        '$2a$10$f/3T5y2wXl9w8c.c/lB/8uA/2kI.E.9w.E5.X.8k.e.G.d.U.I.m.c', -- Senha é '123456'
        now(),
        '',
        null,
        null,
        '{"provider":"email","providers":["email"]}',
        '{"name":"Admin"}',
        now(),
        now(),
        '',
        '',
        null,
        now()
    ) ON CONFLICT (id) DO NOTHING;

    -- Insere o perfil correspondente na tabela public.profiles
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        admin_id,
        'Admin',
        'admin@comandazap.com',
        'admin'
    ) ON CONFLICT (id) DO NOTHING;

END $$;

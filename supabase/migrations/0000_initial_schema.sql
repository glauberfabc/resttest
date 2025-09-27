-- 1. Limpeza Completa (Idempotência)
-- Remove tabelas, políticas e funções existentes para garantir um estado limpo.
-- A opção CASCADE remove objetos dependentes (como as políticas no storage).
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;
drop table if exists public.orders cascade;
drop table if exists public.profiles cascade;

-- Remove a função e o trigger se existirem
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_user_id() cascade;

-- 2. Recriação das Tabelas
-- Tabela para perfis de usuário, ligada à autenticação do Supabase.
create table if not exists public.profiles (
    id uuid references auth.users(id) not null primary key,
    name varchar(255) not null,
    role varchar(50) not null default 'collaborator',
    created_at timestamptz not null default now()
);

-- Tabela para os itens do cardápio.
create table if not exists public.menu_items (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name varchar(255) not null,
    description text,
    price numeric(10, 2) not null,
    category varchar(100) not null,
    image_url text,
    stock integer default 0,
    low_stock_threshold integer default 0,
    unit varchar(50),
    created_at timestamptz not null default now()
);

-- Tabela para clientes.
create table if not exists public.clients (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name varchar(255) not null,
    phone varchar(50),
    document varchar(50),
    created_at timestamptz not null default now()
);

-- Tabela para comandas/pedidos.
create table if not exists public.orders (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    type varchar(50) not null,
    identifier varchar(255) not null,
    status varchar(50) not null default 'open',
    created_at timestamptz not null default now(),
    paid_at timestamptz
);

-- Tabela de junção para itens dentro de uma comanda.
create table if not exists public.order_items (
    order_id uuid references public.orders(id) on delete cascade not null,
    menu_item_id uuid references public.menu_items(id) on delete cascade not null,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

-- Tabela para pagamentos de uma comanda.
create table if not exists public.order_payments (
    id uuid not null default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    amount numeric(10, 2) not null,
    method varchar(50) not null,
    paid_at timestamptz not null default now()
);

-- 3. Função Segura para Obter ID do Usuário (Evita Recursão)
-- Esta função lê o ID do usuário diretamente do token JWT da requisição atual.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- 4. Gatilho (Trigger) para Criar Perfil de Usuário Automaticamente
-- Função que será executada pelo trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Novo Usuário'),
    'collaborator'
  );
  return new;
end;
$$;

-- O trigger que aciona a função acima após cada novo usuário ser criado.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Políticas de Segurança (RLS - Row Level Security)
-- Ativa a RLS para todas as tabelas.
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;

-- Limpa políticas antigas antes de criar novas (Idempotência).
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update their own profile." on public.profiles;
drop policy if exists "Users can manage their own menu items." on public.menu_items;
drop policy if exists "Users can manage their own clients." on public.clients;
drop policy if exists "Users can manage their own orders." on public.orders;
drop policy if exists "Users can view their own orders." on public.orders;


-- Define as políticas de acesso.
create policy "Users can view their own profile." on public.profiles for select
    using ( public.current_user_id() = id );
create policy "Users can insert their own profile." on public.profiles for insert
    with check ( public.current_user_id() = id );
create policy "Users can update their own profile." on public.profiles for update
    using ( public.current_user_id() = id );

create policy "Users can manage their own menu items." on public.menu_items for all
    using ( user_id = public.current_user_id() );

create policy "Users can manage their own clients." on public.clients for all
    using ( user_id = public.current_user_id() );

create policy "Users can manage their own orders." on public.orders for all
    using ( user_id = public.current_user_id() );

create policy "Users can view their own orders." on public.orders for select
    using ( user_id = public.current_user_id() );
    
-- 6. Concede Permissão para o Trigger
-- Permite que o serviço de autenticação execute a função que cria o perfil.
grant execute on function public.handle_new_user() to supabase_auth_admin;

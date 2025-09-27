
-- Limpa completamente o ambiente para garantir um estado inicial limpo
drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;

-- Habilita a extensão pgcrypto se ainda não estiver habilitada
create extension if not exists pgcrypto;

-- Define a função para obter o ID do usuário autenticado a partir do JWT
-- Esta função é segura contra recursão porque lê os dados da requisição, não do banco.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Tabela de Perfis de Usuário
create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  email text not null,
  role text default 'collaborator'
);
alter table public.profiles enable row level security;
create policy "Users can view their own profile." on public.profiles for select
    using ( id = public.current_user_id() );
create policy "Users can update their own profile." on public.profiles for update
    using ( id = public.current_user_id() );


-- Tabela de Itens do Cardápio
create table if not exists public.menu_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    user_id uuid not null references public.profiles(id)
);
alter table public.menu_items enable row level security;
create policy "Users can view menu items." on public.menu_items for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert menu items." on public.menu_items for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their menu items." on public.menu_items for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their menu items." on public.menu_items for delete
    using ( user_id = public.current_user_id() );


-- Tabela de Clientes
create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    document text,
    user_id uuid not null references public.profiles(id)
);
alter table public.clients enable row level security;
create policy "Users can view their own clients." on public.clients for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert their own clients." on public.clients for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their own clients." on public.clients for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their own clients." on public.clients for delete
    using ( user_id = public.current_user_id() );


-- Tabela de Comandas (Orders)
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    type text not null, -- 'table' or 'name'
    identifier text not null,
    status text not null default 'open',
    created_at timestamptz not null default now(),
    paid_at timestamptz,
    user_id uuid not null references public.profiles(id)
);
alter table public.orders enable row level security;
create policy "Users can view their own orders." on public.orders for select
    using ( user_id = public.current_user_id() );
create policy "Users can insert their own orders." on public.orders for insert
    with check ( user_id = public.current_user_id() );
create policy "Users can update their own orders." on public.orders for update
    using ( user_id = public.current_user_id() );
create policy "Users can delete their own orders." on public.orders for delete
    using ( user_id = public.current_user_id() );


-- Tabela de Itens da Comanda (Join Table)
create table if not exists public.order_items (
    order_id uuid not null references public.orders(id) on delete cascade,
    menu_item_id uuid not null references public.menu_items(id),
    quantity integer not null,
    primary key (order_id, menu_item_id)
);
alter table public.order_items enable row level security;
create policy "Users can manage items on their own orders." on public.order_items
    for all using ( exists (
        select 1 from public.orders
        where id = order_id and user_id = public.current_user_id()
    ));


-- Tabela de Pagamentos da Comanda
create table if not exists public.order_payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamptz not null default now()
);
alter table public.order_payments enable row level security;
create policy "Users can manage payments on their own orders." on public.order_payments
    for all using ( exists (
        select 1 from public.orders
        where id = order_id and user_id = public.current_user_id()
    ));


-- Trigger para criar um perfil de usuário quando um novo usuário se registra no Supabase Auth
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

-- 2. Cria o trigger que chama a função após um novo usuário ser criado no auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Permissões para o Supabase Storage (se necessário)
create policy "Users can manage their own product images." on storage.objects for all
    using ( bucket_id = 'menu-images' and owner = public.current_user_id() )
    with check ( bucket_id = 'menu-images' and owner = public.current_user_id() );

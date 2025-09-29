
-- Remove todos os objetos antigos para garantir um estado limpo
drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;

-- TIPOS ENUM (ENUM TYPES)
create type public.order_type as enum ('table', 'name');
create type public.order_status as enum ('open', 'paying', 'paid');
create type public.menu_item_category as enum ('Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional');

-- FUNÇÕES AUXILIARES (HELPER FUNCTIONS)
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- TABELAS (TABLES)
create table public.profiles (
  id uuid not null primary key,
  name text not null,
  email text not null,
  role text not null default 'collaborator'
);

create table public.clients (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  document text
);

create table public.menu_items (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category public.menu_item_category not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.orders (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.order_type not null,
  identifier text not null,
  status public.order_status not null default 'open',
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone
);

create table public.order_items (
  id uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity integer not null,
  unique (order_id, menu_item_id)
);

create table public.order_payments (
  id uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null,
  paid_at timestamp with time zone not null default now()
);

-- TRIGGER PARA SINCRONIZAR AUTH.USERS COM PUBLIC.PROFILES
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

-- HABILITAR ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- POLÍTICAS DE SEGURANÇA (RLS POLICIES)
-- Perfis (Profiles)
create policy "Users can view their own profile." on public.profiles for select
  using ( id = public.current_user_id() );
create policy "Users can update their own profile." on public.profiles for update
  using ( id = public.current_user_id() );

-- Clientes (Clients)
create policy "Users can manage their own clients." on public.clients for all
  using ( user_id = public.current_user_id() );

-- Itens do Cardápio (Menu Items)
create policy "Users can manage their own menu items." on public.menu_items for all
  using ( user_id = public.current_user_id() );

-- Comandas (Orders)
create policy "Users can manage their own orders." on public.orders for all
  using ( user_id = public.current_user_id() );

-- Itens da Comanda (Order Items)
create policy "Users can manage items on their own orders." on public.order_items for all
  using ( exists (select 1 from public.orders where id = order_items.order_id and user_id = public.current_user_id()) );

-- Pagamentos da Comanda (Order Payments)
create policy "Users can manage payments on their own orders." on public.order_payments for all
  using ( exists (select 1 from public.orders where id = order_payments.order_id and user_id = public.current_user_id()) );

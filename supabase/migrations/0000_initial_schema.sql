-- Remove tabelas existentes para garantir um estado limpo
drop table if exists public.profiles cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;

-- Remove tipos ENUM existentes para garantir um estado limpo
drop type if exists public.user_role;
drop type if exists public.order_type;
drop type  if exists public.order_status;
drop type if exists public.menu_item_category;

-- Cria o tipo ENUM para papeis de usuário
create type public.user_role as enum ('admin', 'collaborator');
-- Cria o tipo ENUM para tipos de comanda
create type public.order_type as enum ('table', 'name');
-- Cria o tipo ENUM para status de comanda
create type public.order_status as enum ('open', 'paying', 'paid');
-- Cria o tipo ENUM para categorias de item do cardápio
create type public.menu_item_category as enum ('Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional');


-- Tabela de Perfis de Usuário
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text not null,
  role user_role not null default 'collaborator',
  primary key (id)
);
comment on table public.profiles is 'Armazena informações de perfil para cada usuário.';

-- Tabela de Clientes
create table public.clients (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  phone text,
  document text,
  created_at timestamptz not null default now(),
  primary key (id)
);
comment on table public.clients is 'Armazena informações sobre os clientes do estabelecimento.';

-- Tabela de Itens do Cardápio
create table public.menu_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category menu_item_category not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamptz not null default now(),
  primary key (id)
);
comment on table public.menu_items is 'Contém todos os itens disponíveis no cardápio.';

-- Tabela de Comandas
create table public.orders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type order_type not null,
  identifier text not null,
  status order_status not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  primary key (id)
);
comment on table public.orders is 'Armazena as comandas, que podem ser por mesa ou por nome.';

-- Tabela de Itens da Comanda (tabela de junção)
create table public.order_items (
  order_id uuid not null references public.orders on delete cascade,
  menu_item_id uuid not null references public.menu_items on delete restrict,
  quantity integer not null,
  primary key (order_id, menu_item_id)
);
comment on table public.order_items is 'Associa itens do cardápio a uma comanda com uma quantidade específica.';

-- Tabela de Pagamentos da Comanda
create table public.order_payments (
    id uuid not null default gen_random_uuid(),
    order_id uuid not null references public.orders on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamptz not null default now(),
    primary key (id)
);
comment on table public.order_payments is 'Registra os pagamentos (parciais ou totais) de uma comanda.';


-- FUNÇÃO PARA CRIAR PERFIL DE USUÁRIO AUTOMATICAMENTE
-- Remove a função e o trigger existentes se houver
drop function if exists public.handle_new_user cascade;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$;

-- Trigger que chama a função após um novo usuário ser criado em auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)

-- Habilita RLS para todas as tabelas
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- Remove políticas existentes para garantir idempotência
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can update their own profile." on public.profiles;
drop policy if exists "Users can manage their own clients." on public.clients;
drop policy if exists "Admins can manage all clients." on public.clients;
drop policy if exists "Users can manage their own menu items." on public.menu_items;
drop policy if exists "Admins can manage all menu items." on public.menu_items;
drop policy if exists "Authenticated users can view all menu items." on public.menu_items;
drop policy if exists "Users can manage their own orders." on public.orders;
drop policy if exists "Admins can manage all orders." on public.orders;
drop policy if exists "Users can manage items on their own orders." on public.order_items;
drop policy if exists "Admins can manage all order items." on public.order_items;
drop policy if exists "Users can manage payments on their own orders." on public.order_payments;
drop policy if exists "Admins can manage all order payments." on public.order_payments;


-- Políticas para a tabela PROFILES
create policy "Users can view their own profile." on public.profiles for select
  using ( auth.uid() = id );
create policy "Users can update their own profile." on public.profiles for update
  using ( auth.uid() = id );

-- Políticas para a tabela CLIENTS
create policy "Users can manage their own clients." on public.clients for all
  using ( auth.uid() = user_id );
create policy "Admins can manage all clients." on public.clients for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Políticas para a tabela MENU_ITEMS
create policy "Users can manage their own menu items." on public.menu_items for all
  using ( auth.uid() = user_id );
create policy "Admins can manage all menu items." on public.menu_items for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
create policy "Authenticated users can view all menu items." on public.menu_items for select
  using ( auth.role() = 'authenticated' );

-- Políticas para a tabela ORDERS
create policy "Users can manage their own orders." on public.orders for all
  using ( auth.uid() = user_id );
create policy "Admins can manage all orders." on public.orders for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Políticas para a tabela ORDER_ITEMS
create policy "Users can manage items on their own orders." on public.order_items for all
  using ( auth.uid() = (select user_id from public.orders where id = order_id) );
create policy "Admins can manage all order items." on public.order_items for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
  
-- Políticas para a tabela ORDER_PAYMENTS
create policy "Users can manage payments on their own orders." on public.order_payments for all
  using ( auth.uid() = (select user_id from public.orders where id = order_id) );
create policy "Admins can manage all order payments." on public.order_payments for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Storage: Cria um bucket para imagens do menu
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Política para permitir que usuários autenticados façam upload de imagens
drop policy if exists "Authenticated users can upload menu images." on storage.objects;
create policy "Authenticated users can upload menu images." on storage.objects for insert to authenticated with check ( bucket_id = 'menu-images' );

-- Política para permitir que todos vejam as imagens do menu
drop policy if exists "Anyone can view menu images." on storage.objects;
create policy "Anyone can view menu images." on storage.objects for select using ( bucket_id = 'menu-images' );


-- Apaga as tabelas e tipos se já existirem para garantir um estado limpo
drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

drop type if exists public.user_role;
drop type if exists public.order_status;
drop type if exists public.order_type;
drop type if exists public.menu_item_category;
drop type if exists public.payment_method;

-- Criação de Tipos (ENUMs)
create type public.user_role as enum ('admin', 'collaborator');
create type public.order_status as enum ('open', 'paying', 'paid');
create type public.order_type as enum ('table', 'name');
create type public.menu_item_category as enum ('Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional');
create type public.payment_method as enum ('Débito', 'Crédito', 'PIX', 'Dinheiro');

-- Tabela de Perfis de Usuário
create table public.profiles (
  id uuid not null primary key,
  name text not null,
  email text not null,
  role user_role not null default 'collaborator'
);
comment on table public.profiles is 'Stores user profile information.';

-- Tabela de Itens do Cardápio
create table public.menu_items (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category menu_item_category not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.menu_items is 'Stores all items available on the menu.';

-- Tabela de Clientes
create table public.clients (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  document text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.clients is 'Stores customer information.';

-- Tabela de Comandas (Orders)
create table public.orders (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type order_type not null,
  identifier text not null,
  status order_status not null default 'open',
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone
);
comment on table public.orders is 'Represents an order or a tab for a table or customer.';

-- Tabela de Itens da Comanda (Join Table)
create table public.order_items (
  id uuid not null default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity integer not null,
  unique (order_id, menu_item_id)
);
comment on table public.order_items is 'Joins orders and menu items, storing the quantity.';

-- Tabela de Pagamentos da Comanda
create table public.order_payments (
    id uuid not null default gen_random_uuid() primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method payment_method not null,
    paid_at timestamp with time zone not null default now()
);
comment on table public.order_payments is 'Stores payment details for each order.';

-- Função para obter o ID do usuário atual
create or replace function public.current_user_id()
returns uuid
language sql stable
as $$
  select auth.uid();
$$;

-- Função para obter o Role do usuário atual
create or replace function public.current_user_role()
returns user_role
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'user_role', '')::user_role;
$$;

-- Função do Trigger para criar perfil de usuário
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

-- Trigger para criar perfil de usuário
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Habilita RLS para todas as tabelas
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- Políticas de Segurança (RLS)

-- Tabela: profiles
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile." on public.profiles for select
  using ( auth.uid() = id );

-- Tabela: menu_items
drop policy if exists "Admins can do anything." on public.menu_items;
create policy "Admins can do anything." on public.menu_items for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
drop policy if exists "Collaborators can view menu items." on public.menu_items;
create policy "Collaborators can view menu items." on public.menu_items for select
  using ( (select role from public.profiles where id = auth.uid()) = 'collaborator' );

-- Tabela: clients
drop policy if exists "Admins can do anything." on public.clients;
create policy "Admins can do anything." on public.clients for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
drop policy if exists "Collaborators can manage their own clients." on public.clients;
create policy "Collaborators can manage their own clients." on public.clients for all
  using ( (select role from public.profiles where id = auth.uid()) = 'collaborator' and user_id = auth.uid() );

-- Tabela: orders
drop policy if exists "Admins can do anything." on public.orders;
create policy "Admins can do anything." on public.orders for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
drop policy if exists "Collaborators can manage their own orders." on public.orders;
create policy "Collaborators can manage their own orders." on public.orders for all
  using ( (select role from public.profiles where id = auth.uid()) = 'collaborator' and user_id = auth.uid() );

-- Tabela: order_items
drop policy if exists "Admins can do anything." on public.order_items;
create policy "Admins can do anything." on public.order_items for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
drop policy if exists "Users can manage items on their own orders." on public.order_items;
create policy "Users can manage items on their own orders." on public.order_items for all
  using ( exists (select 1 from public.orders where id = order_id and user_id = auth.uid()) );

-- Tabela: order_payments
drop policy if exists "Admins can do anything." on public.order_payments;
create policy "Admins can do anything." on public.order_payments for all
  using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
drop policy if exists "Users can manage payments on their own orders." on public.order_payments;
create policy "Users can manage payments on their own orders." on public.order_payments for all
  using ( exists (select 1 from public.orders where id = order_id and user_id = auth.uid()) );

-- Concede permissões para o trigger funcionar
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant usage on schema auth to postgres;
grant select on table auth.users to postgres;


-- Limpa o banco de dados de configurações antigas para garantir um estado limpo
drop table if exists public.profiles cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.orders cascade;
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;
drop function if exists public.current_user_id() cascade;
drop function if exists public.handle_new_user() cascade;

-- Tabela de perfis de usuário
create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  email text not null,
  role text not null default 'collaborator',
  constraint fk_user foreign key (id) references auth.users(id) on delete cascade
);

-- Tabela de itens do cardápio
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de clientes
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  phone text,
  document text,
  created_at timestamptz not null default now()
);

-- Tabela de comandas
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('table', 'name')),
  identifier text not null,
  status text not null default 'open' check (status in ('open', 'paying', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Tabela de itens da comanda
create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  quantity integer not null,
  primary key (order_id, menu_item_id)
);

-- Tabela de pagamentos da comanda
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null,
  paid_at timestamptz not null default now()
);

-- Função para obter o ID do usuário autenticado de forma segura
create or replace function public.current_user_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Função de Trigger para criar um perfil quando um novo usuário se registra
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

-- Trigger para chamar a função handle_new_user
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

-- Remove políticas antigas para garantir a idempotência
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can update their own profile." on public.profiles;
drop policy if exists "Users can view their own menu items." on public.menu_items;
drop policy if exists "Users can insert their own menu items." on public.menu_items;
drop policy if exists "Users can update their own menu items." on public.menu_items;
drop policy if exists "Users can delete their own menu items." on public.menu_items;
drop policy if exists "Users can view their own clients." on public.clients;
drop policy if exists "Users can insert their own clients." on public.clients;
drop policy if exists "Users can update their own clients." on public.clients;
drop policy if exists "Users can delete their own clients." on public.clients;
drop policy if exists "Users can view their own orders." on public.orders;
drop policy if exists "Users can insert their own orders." on public.orders;
drop policy if exists "Users can update their own orders." on public.orders;
drop policy if exists "Users can delete their own orders." on public.orders;
drop policy if exists "Users can manage items for their own orders." on public.order_items;
drop policy if exists "Users can manage payments for their own orders." on public.order_payments;

-- Políticas de RLS para a tabela de perfis
create policy "Users can view their own profile." on public.profiles for select using (id = public.current_user_id());
create policy "Users can update their own profile." on public.profiles for update using (id = public.current_user_id());

-- Políticas de RLS para a tabela de itens do cardápio
create policy "Users can view their own menu items." on public.menu_items for select using (user_id = public.current_user_id());
create policy "Users can insert their own menu items." on public.menu_items for insert with check (user_id = public.current_user_id());
create policy "Users can update their own menu items." on public.menu_items for update using (user_id = public.current_user_id());
create policy "Users can delete their own menu items." on public.menu_items for delete using (user_id = public.current_user_id());

-- Políticas de RLS para a tabela de clientes
create policy "Users can view their own clients." on public.clients for select using (user_id = public.current_user_id());
create policy "Users can insert their own clients." on public.clients for insert with check (user_id = public.current_user_id());
create policy "Users can update their own clients." on public.clients for update using (user_id = public.current_user_id());
create policy "Users can delete their own clients." on public.clients for delete using (user_id = public.current_user_id());

-- Políticas de RLS para a tabela de comandas
create policy "Users can view their own orders." on public.orders for select using (user_id = public.current_user_id());
create policy "Users can insert their own orders." on public.orders for insert with check (user_id = public.current_user_id());
create policy "Users can update their own orders." on public.orders for update using (user_id = public.current_user_id());
create policy "Users can delete their own orders." on public.orders for delete using (user_id = public.current_user_id());

-- Políticas de RLS para tabelas relacionadas (order_items, order_payments)
create policy "Users can manage items for their own orders." on public.order_items for all
  using (exists (select 1 from public.orders where id = order_id and user_id = public.current_user_id()));
create policy "Users can manage payments for their own orders." on public.order_payments for all
  using (exists (select 1 from public.orders where id = order_id and user_id = public.current_user_id()));

-- Concede permissões para o trigger de criação de usuário funcionar corretamente
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant usage on schema auth to postgres;
grant select on table auth.users to postgres;

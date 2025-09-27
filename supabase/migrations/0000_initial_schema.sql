-- Limpa completamente o ambiente para garantir um estado inicial limpo.
-- A opção CASCADE remove todos os objetos dependentes (como políticas, etc).
drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

-- Remove funções e triggers antigos se existirem
drop function if exists public.current_user_id() cascade;
drop function if exists public.handle_new_user() cascade;
drop trigger if exists on_auth_user_created on auth.users;


-- Tabela de Perfis de Usuário
-- Armazena dados públicos dos usuários, como nome e função.
create table if not exists public.profiles (
  id uuid not null primary key,
  name text not null,
  email text not null,
  role text not null default 'collaborator'::text,
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);
comment on table public.profiles is 'Profile data for each user.';

-- Tabela de Itens do Cardápio
create table if not exists public.menu_items (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text,
    user_id uuid not null,
    created_at timestamp with time zone not null default now(),
    constraint menu_items_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Tabela de Clientes
create table if not exists public.clients (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    phone text,
    document text,
    user_id uuid not null,
    created_at timestamp with time zone not null default now(),
    constraint clients_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Tabela de Comandas (Orders)
create table if not exists public.orders (
    id uuid not null default gen_random_uuid() primary key,
    type text not null,
    identifier text not null,
    status text not null,
    user_id uuid not null,
    created_at timestamp with time zone not null default now(),
    paid_at timestamp with time zone,
    constraint orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Tabela de Itens da Comanda (Tabela de Junção)
create table if not exists public.order_items (
    order_id uuid not null,
    menu_item_id uuid not null,
    quantity integer not null,
    primary key (order_id, menu_item_id),
    constraint order_items_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
    constraint order_items_menu_item_id_fkey foreign key (menu_item_id) references public.menu_items (id) on delete cascade
);

-- Tabela de Pagamentos da Comanda
create table if not exists public.order_payments (
    id uuid not null default gen_random_uuid() primary key,
    order_id uuid not null,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamp with time zone not null default now(),
    constraint order_payments_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade
);

-- Função auxiliar para obter o ID do usuário autenticado a partir do JWT.
-- Isso evita a recursão infinita nas políticas de segurança.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Função de Trigger para criar um novo perfil quando um novo usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer -- ESSENCIAL: Executa com os privilégios do criador (postgres)
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

-- Trigger que chama a função handle_new_user após um novo usuário ser criado em auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Concede permissões para que a função do trigger (executada pelo postgres) possa ler o schema auth.
grant usage on schema auth to postgres;
grant select on all tables in schema auth to postgres;


-- Ativa a Segurança a Nível de Linha (RLS) para todas as tabelas.
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- Políticas de Segurança (RLS)

-- Tabela de Perfis
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile." on public.profiles for select
  using ( id = public.current_user_id() );

drop policy if exists "Users can update their own profile." on public.profiles;
create policy "Users can update their own profile." on public.profiles for update
  using ( id = public.current_user_id() );

-- Tabelas principais (menu_items, clients, orders, etc.)
-- A regra geral é: usuários podem fazer tudo (CRUD) nos dados que eles mesmos criaram (user_id corresponde ao seu ID).
drop policy if exists "Users can manage their own data." on public.menu_items;
create policy "Users can manage their own data." on public.menu_items for all
  using ( user_id = public.current_user_id() );

drop policy if exists "Users can manage their own data." on public.clients;
create policy "Users can manage their own data." on public.clients for all
  using ( user_id = public.current_user_id() );

drop policy if exists "Users can manage their own data." on public.orders;
create policy "Users can manage their own data." on public.orders for all
  using ( user_id = public.current_user_id() );

-- Tabelas de junção e detalhes (order_items, order_payments)
-- A regra é: se um usuário tem permissão para ver a comanda (order), ele também pode ver os itens e pagamentos associados.
drop policy if exists "Users can view items of orders they own." on public.order_items;
create policy "Users can view items of orders they own." on public.order_items for select
  using ( exists (select 1 from public.orders where id = order_items.order_id and user_id = public.current_user_id()) );

drop policy if exists "Users can manage items of orders they own." on public.order_items;
create policy "Users can manage items of orders they own." on public.order_items for all
    using ( exists(select 1 from orders where orders.id = order_items.order_id and orders.user_id = public.current_user_id()) );

drop policy if exists "Users can view payments of orders they own." on public.order_payments;
create policy "Users can view payments of orders they own." on public.order_payments for select
  using ( exists (select 1 from public.orders where id = order_payments.order_id and user_id = public.current_user_id()) );

drop policy if exists "Users can manage payments of orders they own." on public.order_payments;
create policy "Users can manage payments of orders they own." on public.order_payments for all
    using ( exists(select 1 from orders where orders.id = order_payments.order_id and orders.user_id = public.current_user_id()) );

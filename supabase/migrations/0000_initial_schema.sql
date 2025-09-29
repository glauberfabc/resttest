-- Apaga tabelas antigas se existirem
drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

-- Extensões
create extension if not exists "uuid-ossp" with schema extensions;

-- Tipos customizados
create type public.user_role as enum ('admin', 'collaborator');
create type public.order_type as enum ('table', 'name');
create type public.order_status as enum ('open', 'paying', 'paid');
create type public.menu_item_category as enum (
  'Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional'
);
create type public.payment_method as enum ('Dinheiro', 'PIX', 'Débito', 'Crédito');

-- Tabela PROFILES
create table public.profiles (
    id uuid not null primary key,
    name text not null,
    role user_role not null default 'collaborator'
);

comment on table public.profiles is 'Armazena informações de perfil para cada usuário.';
comment on column public.profiles.id is 'Referência ao auth.users.id';

-- Tabela MENU_ITEMS
create table public.menu_items (
    id uuid not null primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
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

-- Tabela CLIENTS
create table public.clients (
    id uuid not null primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    phone text,
    document text,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

-- Tabela ORDERS
create table public.orders (
    id uuid not null primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
    type order_type not null,
    identifier text not null,
    status order_status not null,
    created_at timestamp with time zone not null default now(),
    paid_at timestamp with time zone
);

-- Tabela ORDER_ITEMS
create table public.order_items (
    order_id uuid references public.orders(id) on delete cascade not null,
    menu_item_id uuid references public.menu_items(id) on delete restrict not null,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

-- Tabela ORDER_PAYMENTS
create table public.order_payments (
    id uuid not null primary key default uuid_generate_v4(),
    order_id uuid references public.orders(id) on delete cascade not null,
    amount numeric(10, 2) not null,
    method payment_method not null,
    paid_at timestamp with time zone not null default now()
);


-- Função para criar perfil de usuário automaticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para executar a função acima quando um novo usuário se registra
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Cria usuário administrador se não existir
-- Este é um truque para inserir um usuário se ele não existir, para ser idempotente
do $$
declare
  admin_email text := 'admin@comandazap.com';
  admin_pass text := '123456'; -- Considere usar uma variável de ambiente
  admin_user_id uuid;
begin
  -- Verifica se o usuário já existe
  select id into admin_user_id from auth.users where email = admin_email;

  if admin_user_id is null then
    -- Cria o usuário no auth
    admin_user_id := extensions.uuid_generate_v4(); -- Gere um UUID
    insert into auth.users (id, email, encrypted_password, aud, role, created_at, updated_at)
    values (admin_user_id, admin_email, crypt(admin_pass, gen_salt('bf')), 'authenticated', 'authenticated', now(), now());

    -- Cria a identidade do usuário
    insert into auth.identities (id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (extensions.uuid_generate_v4(), admin_user_id, 'email', format('{"sub":"%s","email":"%s"}', admin_user_id, admin_email)::jsonb, now(), now(), now());
  
    -- Cria o perfil público
    insert into public.profiles (id, name, role)
    values (admin_user_id, 'Admin', 'admin');
  else
    -- Se o usuário existe, apenas garante que o perfil exista e seja admin
    update public.profiles set role = 'admin' where id = admin_user_id;
  end if;
end $$;


-- POLÍTICAS DE SEGURANÇA (RLS)

-- Habilita RLS para todas as tabelas
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- Limpa políticas antigas
drop policy if exists "Users can view their own profile." on public.profiles;
drop policy if exists "Users can manage their own menu items." on public.menu_items;
drop policy if exists "Users can view menu items from their own user group." on public.menu_items;
drop policy if exists "Users can manage their own clients." on public.clients;
drop policy if exists "Users can view clients from their own user group." on public.clients;
drop policy if exists "Users can manage their own orders." on public.orders;
drop policy if exists "Users can view orders from their own user group." on public.orders;
drop policy if exists "Users can manage items of their own orders." on public.order_items;
drop policy if exists "Users can view items of orders from their own user group." on public.order_items;
drop policy if exists "Users can manage payments of their own orders." on public.order_payments;
drop policy if exists "Users can view payments of orders from their own user group." on public.order_payments;

-- PROFILES
create policy "Users can view their own profile." on public.profiles for select
  using ( auth.uid() = id );

-- MENU ITEMS
create policy "Users can manage their own menu items." on public.menu_items for all
  using ( auth.uid() = user_id );

-- CLIENTS
create policy "Users can manage their own clients." on public.clients for all
  using ( auth.uid() = user_id );

-- ORDERS
create policy "Users can manage their own orders." on public.orders for all
  using ( auth.uid() = user_id );

-- ORDER ITEMS
create policy "Users can manage items of their own orders." on public.order_items for all
  using ( exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()) );

-- ORDER PAYMENTS
create policy "Users can manage payments of their own orders." on public.order_payments for all
  using ( exists (select 1 from public.orders where orders.id = order_payments.order_id and orders.user_id = auth.uid()) );


-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/jpg'])
on conflict (id) do nothing;

drop policy if exists "Allow public read access" on storage.objects;
drop policy if exists "Allow authenticated users to upload" on storage.objects;
drop policy if exists "Allow user to manage their own files" on storage.objects;


create policy "Allow public read access" on storage.objects for select to public
  using ( bucket_id = 'menu-images' );

create policy "Allow authenticated users to upload" on storage.objects for insert to authenticated
  with check ( bucket_id = 'menu-images' );

create policy "Allow user to manage their own files" on storage.objects for all to authenticated
  using ( bucket_id = 'menu-images' and auth.uid() = owner )
  with check ( bucket_id = 'menu-images' and auth.uid() = owner );

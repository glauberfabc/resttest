
-- Remove todos os objetos existentes para garantir um estado limpo.
drop table if exists public.order_items cascade;
drop table if exists public.order_payments cascade;
drop table if exists public.orders cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.profiles cascade;
drop type if exists public.order_status cascade;
drop type if exists public.order_type cascade;
drop type if exists public.user_role cascade;
drop type if exists public.menu_item_category cascade;
drop function if exists public.handle_new_user cascade;

-- EXTENSIONS
create extension if not exists "uuid-ossp" with schema extensions;

-- TIPOS
create type public.order_status as enum ('open', 'paying', 'paid');
create type public.order_type as enum ('table', 'name');
create type public.user_role as enum ('admin', 'collaborator');
create type public.menu_item_category as enum ('Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional');

-- TABELAS
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'collaborator'
);

create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  document text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category menu_item_category not null,
  image_url text,
  stock integer,
  low_stock_threshold integer,
  unit text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  identifier text not null,
  type order_type not null,
  status order_status not null default 'open',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  primary key (order_id, menu_item_id)
);

create table public.order_payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null,
  paid_at timestamptz not null default now()
);


-- FUNÇÃO E TRIGGER para sincronizar auth.users com public.profiles
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- SEED: INSERE O USUÁRIO ADMIN (se não existir)
-- Isso é executado como superusuário, então não aciona o RLS.
do $$
declare
    admin_email text := 'admin@comandazap.com';
    admin_pass text := '123456'; -- Senha fraca para desenvolvimento
    admin_user_id uuid;
begin
    -- Verifica se o usuário já existe em auth.users
    select id into admin_user_id from auth.users where email = admin_email;

    -- Se não existir, cria o usuário em auth.users
    if admin_user_id is null then
        admin_user_id := extensions.uuid_generate_v4();
        insert into auth.users (id, email, encrypted_password, aud, role, created_at, updated_at)
        values (admin_user_id, admin_email, crypt(admin_pass, gen_salt('bf')), 'authenticated', 'authenticated', now(), now());
    end if;

    -- Garante que o perfil correspondente exista e tenha o role 'admin'
    insert into public.profiles (id, name, email, role)
    values (admin_user_id, 'Admin', admin_email, 'admin')
    on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        role = excluded.role;

end $$;


-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY)

-- Habilita RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- PROFILES
drop policy if exists "Users can view their own profile." on public.profiles;
create policy "Users can view their own profile." on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists "Users can update their own profile." on public.profiles;
create policy "Users can update their own profile." on public.profiles for update
  using ( auth.uid() = id );

-- CLIENTS
drop policy if exists "Users can manage their own clients." on public.clients;
create policy "Users can manage their own clients." on public.clients for all
  using ( auth.uid() = user_id );

-- MENU ITEMS
drop policy if exists "Users can manage their own menu items." on public.menu_items;
create policy "Users can manage their own menu items." on public.menu_items for all
  using ( auth.uid() = user_id );

drop policy if exists "Authenticated users can view all menu items." on public.menu_items;
create policy "Authenticated users can view all menu items." on public.menu_items for select
  to authenticated
  using ( true );

-- ORDERS
drop policy if exists "Users can manage their own orders." on public.orders;
create policy "Users can manage their own orders." on public.orders for all
  using ( auth.uid() = user_id );

-- ORDER ITEMS
drop policy if exists "Users can manage items on their own orders." on public.order_items;
create policy "Users can manage items on their own orders." on public.order_items for all
  using ( exists (select 1 from public.orders where orders.id = order_id and orders.user_id = auth.uid()) );

-- ORDER PAYMENTS
drop policy if exists "Users can manage payments on their own orders." on public.order_payments;
create policy "Users can manage payments on their own orders." on public.order_payments for all
  using ( exists (select 1 from public.orders where orders.id = order_id and orders.user_id = auth.uid()) );


-- PERMISSÕES DE STORAGE

-- Cria bucket para imagens do cardápio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, '{"image/jpeg","image/png","image/webp"}')
on conflict (id) do nothing;

-- Política para permitir que usuários autenticados vejam todas as imagens
drop policy if exists "Allow public read access to all images" on storage.objects;
create policy "Allow public read access to all images" on storage.objects for select
  using ( bucket_id = 'menu-images' );

-- Política para permitir que usuários autenticados gerenciem suas próprias imagens
drop policy if exists "Allow authenticated users to manage their own images" on storage.objects;
create policy "Allow authenticated users to manage their own images" on storage.objects for all
  using ( auth.uid() = owner )
  with check ( auth.uid() = owner );

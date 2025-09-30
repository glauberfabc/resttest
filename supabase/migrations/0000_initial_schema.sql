-- Apaga todos os objetos do banco em ordem de dependência para garantir uma recriação limpa.
drop table if exists public.order_payments cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.clients cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.profiles cascade;

-- Recria as tabelas.
create table public.profiles (
    id uuid not null primary key,
    name text,
    role text default 'collaborator'::text,
    constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);

create table public.clients (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    phone text,
    document text
);

create table public.menu_items (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    description text,
    price numeric(10, 2) not null,
    category text not null,
    image_url text,
    stock integer,
    low_stock_threshold integer,
    unit text
);

create table public.orders (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    type text not null,
    identifier text not null,
    status text not null default 'open',
    created_at timestamptz not null default now(),
    paid_at timestamptz
);

create table public.order_items (
    order_id uuid not null references public.orders(id) on delete cascade,
    menu_item_id uuid not null references public.menu_items(id) on delete cascade,
    quantity integer not null,
    primary key (order_id, menu_item_id)
);

create table public.order_payments (
    id uuid not null default gen_random_uuid() primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    amount numeric(10, 2) not null,
    method text not null,
    paid_at timestamptz not null default now()
);

-- Ativa a segurança em nível de linha (RLS) para todas as tabelas.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- Cria as políticas de segurança.
-- Perfis (Profiles)
create policy "Users can view their own profile." on public.profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);

-- Clientes (Clients)
create policy "Users can view their own clients." on public.clients for select using (auth.uid() = user_id);
create policy "Users can insert their own clients." on public.clients for insert with check (auth.uid() = user_id);
create policy "Users can update their own clients." on public.clients for update using (auth.uid() = user_id);
create policy "Users can delete their own clients." on public.clients for delete using (auth.uid() = user_id);

-- Itens do Cardápio (Menu Items)
create policy "All users can view menu items." on public.menu_items for select using (true);
create policy "Authenticated users can insert menu items." on public.menu_items for insert with check (auth.role() = 'authenticated');
create policy "Users can update their own menu items." on public.menu_items for update using (auth.uid() = user_id);
create policy "Users can delete their own menu items." on public.menu_items for delete using (auth.uid() = user_id);

-- Comandas (Orders)
create policy "Users can view their own orders." on public.orders for select using (auth.uid() = user_id);
create policy "Users can insert their own orders." on public.orders for insert with check (auth.uid() = user_id);
create policy "Users can update their own orders." on public.orders for update using (auth.uid() = user_id);
create policy "Users can delete their own orders." on public.orders for delete using (auth.uid() = user_id);

-- Itens da Comanda (Order Items)
create policy "Users can manage items on their own orders." on public.order_items for all
    using (auth.uid() = (select user_id from public.orders where id = order_id));

-- Pagamentos da Comanda (Order Payments)
create policy "Users can manage payments on their own orders." on public.order_payments for all
    using (auth.uid() = (select user_id from public.orders where id = order_id));

-- Configuração do Storage para imagens do cardápio.
-- Cria o bucket se ele não existir.
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Política de leitura: Permite que qualquer pessoa veja as imagens.
create policy "Public read access for menu images" on storage.objects for select
using ( bucket_id = 'menu-images' );

-- Política de escrita: Permite que apenas usuários autenticados enviem imagens.
create policy "Authenticated users can upload menu images" on storage.objects for insert
with check ( bucket_id = 'menu-images' and auth.role() = 'authenticated' );

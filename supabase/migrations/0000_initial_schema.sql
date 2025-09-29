-- Define o tipo para a categoria do item de menu
create type public.menu_item_category as enum (
  'Lanches', 'Porções', 'Bebidas', 'Salgados', 'Pratos Quentes', 'Saladas', 'Destilados', 'Caipirinhas', 'Bebidas Quentes', 'Adicional'
);

-- Define o tipo para o status da comanda
create type public.order_status as enum (
  'open', 'paying', 'paid'
);

-- Define o tipo para o tipo da comanda
create type public.order_type as enum (
  'table', 'name'
);

-- Define o tipo para o papel do usuário
create type public.user_role as enum (
  'admin', 'collaborator'
);

-- Tabela de perfis de usuário
create table public.profiles (
  id uuid not null primary key,
  name text not null,
  email text not null,
  role user_role not null default 'collaborator'
);

-- Tabela de itens do menu
create table public.menu_items (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text null,
  price numeric(10, 2) not null,
  category public.menu_item_category not null,
  image_url text null,
  stock integer null,
  low_stock_threshold integer null,
  unit text null,
  created_at timestamp with time zone not null default now()
);

-- Tabela de clientes
create table public.clients (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text null,
  document text null,
  created_at timestamp with time zone not null default now()
);

-- Tabela de comandas
create table public.orders (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.order_type not null,
  identifier text not null,
  status public.order_status not null default 'open',
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone null
);

-- Tabela de itens da comanda (tabela de junção)
create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity integer not null,
  primary key (order_id, menu_item_id)
);

-- Tabela de pagamentos da comanda
create table public.order_payments (
  id uuid not null default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null,
  paid_at timestamp with time zone not null default now()
);

-- Função auxiliar para obter o ID do usuário logado
create or replace function public.current_user_id()
returns uuid as $$
  select auth.uid();
$$ language sql stable;

-- Função para ser acionada pelo trigger de criação de usuário
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

-- Trigger que chama a função após um novo usuário ser criado
create or replace trigger on_auth_user_created
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

-- Tabela PROFILES
create policy "Users can view their own profile." on public.profiles for select
  using ( auth.uid() = id );
create policy "Users can update their own profile." on public.profiles for update
  using ( auth.uid() = id );

-- Tabela MENU_ITEMS
create policy "Users can view their own menu items." on public.menu_items for select
  using ( user_id = public.current_user_id() );
create policy "Users can insert their own menu items." on public.menu_items for insert
  with check ( user_id = public.current_user_id() );
create policy "Users can update their own menu items." on public.menu_items for update
  using ( user_id = public.current_user_id() );
create policy "Users can delete their own menu items." on public.menu_items for delete
  using ( user_id = public.current_user_id() );

-- Tabela CLIENTS
create policy "Users can view their own clients." on public.clients for select
  using ( user_id = public.current_user_id() );
create policy "Users can insert their own clients." on public.clients for insert
  with check ( user_id = public.current_user_id() );
create policy "Users can update their own clients." on public.clients for update
  using ( user_id = public.current_user_id() );
create policy "Users can delete their own clients." on public.clients for delete
  using ( user_id = public.current_user_id() );

-- Tabela ORDERS
create policy "Users can view their own orders." on public.orders for select
  using ( user_id = public.current_user_id() );
create policy "Users can insert their own orders." on public.orders for insert
  with check ( user_id = public.current_user_id() );
create policy "Users can update their own orders." on public.orders for update
  using ( user_id = public.current_user_id() );
create policy "Users can delete their own orders." on public.orders for delete
  using ( user_id = public.current_user_id() );

-- Tabela ORDER_ITEMS
create policy "Users can manage items for their own orders." on public.order_items for all
  using ( exists (select 1 from public.orders where id = order_id and user_id = public.current_user_id()) );

-- Tabela ORDER_PAYMENTS
create policy "Users can manage payments for their own orders." on public.order_payments for all
  using ( exists (select 1 from public.orders where id = order_id and user_id = public.current_user_id()) );


-- Permissões para o storage
create policy "Menu images are publicly accessible." on storage.objects for select
  using ( bucket_id = 'menu-images' );

create policy "Users can upload menu images." on storage.objects for insert
  with check ( bucket_id = 'menu-images' and auth.uid() = (storage.foldername(name))[1]::uuid );

create policy "Users can update their own menu images." on storage.objects for update
  using ( auth.uid() = (storage.foldername(name))[1]::uuid and bucket_id = 'menu-images' );

create policy "Users can delete their own menu images." on storage.objects for delete
  using ( auth.uid() = (storage.foldername(name))[1]::uuid and bucket_id = 'menu-images' );

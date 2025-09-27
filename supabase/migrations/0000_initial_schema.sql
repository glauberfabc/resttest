-- Create a table for public profiles
create table if not exists
  public.profiles (
    id uuid not null references auth.users on delete cascade,
    name text,
    role text,
    primary key (id)
  );

alter table public.profiles enable row level security;

-- Policies for profiles
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for
select
  using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert
with
  check (auth.uid () = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update
using (auth.uid () = id);

-- This trigger automatically creates a profile for new users.
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'collaborator');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row
execute function public.handle_new_user();

-- Policies for menu_items
alter table public.menu_items enable row level security;

drop policy if exists "Menu items are viewable by everyone." on public.menu_items;
create policy "Menu items are viewable by everyone." on public.menu_items for
select
  using (true);

drop policy if exists "Admins and collaborators can insert menu items." on public.menu_items;
create policy "Admins and collaborators can insert menu items." on public.menu_items for insert
with
  check (
    (
      select
        role
      from
        public.profiles
      where
        id = auth.uid ()
    ) in ('admin', 'collaborator')
  );

drop policy if exists "Admins and collaborators can update menu items." on public.menu_items;
create policy "Admins and collaborators can update menu items." on public.menu_items for update
using (
  (
    select
      role
    from
      public.profiles
    where
      id = auth.uid ()
  ) in ('admin', 'collaborator')
)
with
  check (
    (
      select
        role
      from
        public.profiles
      where
        id = auth.uid ()
    ) in ('admin', 'collaborator')
  );

drop policy if exists "Admins and collaborators can delete menu items." on public.menu_items;
create policy "Admins and collaborators can delete menu items." on public.menu_items for delete using (
  (
    select
      role
    from
      public.profiles
    where
      id = auth.uid ()
  ) in ('admin', 'collaborator')
);

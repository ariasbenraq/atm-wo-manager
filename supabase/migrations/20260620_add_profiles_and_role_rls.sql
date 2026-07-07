-- +------------------------------+
-- |  Profiles & Role-based RLS  |
-- +------------------------------+

-- 1. Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  full_name text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Anyone (even anon) can read profiles for login lookup.
-- Only email and username are needed pre-auth; full access once logged in.
create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

-- Only admin can insert/update/delete profiles
create policy "Admin can insert profiles"
  on public.profiles for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can update profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can delete profiles"
  on public.profiles for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 2. Helper function: is_admin()
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 3. Auto-create profile on signup
-- Pass username via raw_user_meta_data: {"username": "jperez", "full_name": "Juan Perez"}
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  raw_meta jsonb;
begin
  raw_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  insert into public.profiles (id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(raw_meta ->> 'username', split_part(coalesce(new.email, ''), '@', 1), null),
    coalesce(raw_meta ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: create profiles for existing auth users (idempotent)
insert into public.profiles (id, email, username, full_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'username', split_part(coalesce(email, ''), '@', 1), null),
  coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1), ''),
  'user'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- 4. RLS on repuestos
alter table public.repuestos enable row level security;

drop policy if exists "Todos pueden ver repuestos" on public.repuestos;
create policy "Todos pueden ver repuestos"
  on public.repuestos for select
  using (true);

drop policy if exists "Solo admin puede crear repuestos" on public.repuestos;
create policy "Solo admin puede crear repuestos"
  on public.repuestos for insert
  with check (public.is_admin());

drop policy if exists "Solo admin puede editar repuestos" on public.repuestos;
create policy "Solo admin puede editar repuestos"
  on public.repuestos for update
  using (public.is_admin());

drop policy if exists "Solo admin puede eliminar repuestos" on public.repuestos;
create policy "Solo admin puede eliminar repuestos"
  on public.repuestos for delete
  using (public.is_admin());

-- 5. Replace spare_part_lists policies (drop old, add role-aware)
drop policy if exists "Users can view their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can insert their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can update their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can delete their own spare part lists" on public.spare_part_lists;

create policy "Usuarios ven sus listas, admin ve todas"
  on public.spare_part_lists for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios crean sus listas, admin crea cualquiera"
  on public.spare_part_lists for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Usuarios editan sus listas, admin edita cualquiera"
  on public.spare_part_lists for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios eliminan sus listas, admin elimina cualquiera"
  on public.spare_part_lists for delete
  using (auth.uid() = user_id or public.is_admin());

-- 6. Replace spare_part_list_items policies (drop old, add role-aware)
drop policy if exists "Users can view items in their lists" on public.spare_part_list_items;
drop policy if exists "Users can insert items in their lists" on public.spare_part_list_items;
drop policy if exists "Users can delete items from their lists" on public.spare_part_list_items;

create policy "Items visibles para dueno o admin"
  on public.spare_part_list_items for select
  using (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Items insertables por dueno o admin"
  on public.spare_part_list_items for insert
  with check (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Items eliminables por dueno o admin"
  on public.spare_part_list_items for delete
  using (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and (user_id = auth.uid() or public.is_admin())
    )
  );

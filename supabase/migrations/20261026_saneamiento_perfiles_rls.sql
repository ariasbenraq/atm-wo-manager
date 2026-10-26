-- +--------------------------------------------------+
-- |   Saneamiento previo al plan de inventario       |
-- +--------------------------------------------------+
-- El diagnóstico (supabase/diagnostico_inventario.sql, 8f/8g) mostró que
-- 20260620_add_profiles_and_role_rls.sql quedó aplicada a medias:
--   - el backfill de perfiles no corrió (cuentas de abril sin perfil),
--   - no existe ningún admin, así que is_admin() siempre es falso,
--   - repuestos conserva políticas abiertas a cualquier autenticado que
--     anulan las de "solo admin" (las políticas permisivas se suman con OR),
--   - spare_part_lists conserva las políticas viejas que debían eliminarse.

-- 1. Perfil faltante del CE principal y rol admin
insert into public.profiles (id, email, username, full_name, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'username', split_part(coalesce(u.email, ''), '@', 1)),
       coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, ''), '@', 1), ''),
       'admin'
from auth.users u
where u.id = '41606918-f032-43ed-96b1-18bf53f09752'
on conflict (id) do update set role = 'admin';

-- 2. repuestos: escritura solo para admin (como indica AGENTS.md)
drop policy if exists "repuestos_insert_authenticated" on public.repuestos;
drop policy if exists "repuestos_update_authenticated" on public.repuestos;
drop policy if exists "repuestos_delete_authenticated" on public.repuestos;
-- Duplica a "Todos pueden ver repuestos"
drop policy if exists "repuestos_select_authenticated" on public.repuestos;

-- 3. spare_part_lists: quitar las políticas viejas (las nuevas ya cubren al dueño)
drop policy if exists "Users can view their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can insert their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can update their own spare part lists" on public.spare_part_lists;
drop policy if exists "Users can delete their own spare part lists" on public.spare_part_lists;

-- La cuenta de prueba tecnion613@gmail.com no recibe perfil: eliminarla
-- desde Authentication → Users en el panel de Supabase.

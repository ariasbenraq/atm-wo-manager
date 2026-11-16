-- Registro de usuarios con aprobación del administrador, suspensión y
-- reinicio de clave.
--
-- Estados de cuenta (profiles.estado):
--   pendiente   → se registró desde la app; no ve ni escribe datos hasta que
--                 un admin la apruebe.
--   activo      → uso normal (todas las cuentas anteriores a esta migración).
--   suspendido  → bloqueado: además de este estado, la Edge Function
--                 admin-usuarios banea la cuenta en Auth y cierra sus sesiones.
--
-- Requiere (panel de Supabase): Auth → Providers → Email → desactivar
-- "Confirm email".

-- 1. Columnas nuevas ---------------------------------------------------------

alter table public.profiles add column if not exists nombre   text not null default '';
alter table public.profiles add column if not exists apellido text not null default '';
alter table public.profiles add column if not exists contrata text;
alter table public.profiles add column if not exists estado   text not null default 'activo';
alter table public.profiles add column if not exists suspendido_en       timestamptz;
alter table public.profiles add column if not exists clave_reiniciada_en timestamptz;

alter table public.profiles drop constraint if exists profiles_contrata_check;
alter table public.profiles add constraint profiles_contrata_check
  check (contrata is null or contrata in ('IDERKA', 'FONTA'));

alter table public.profiles drop constraint if exists profiles_estado_check;
alter table public.profiles add constraint profiles_estado_check
  check (estado in ('pendiente', 'activo', 'suspendido'));

-- Perfiles existentes: nombre/apellido a partir de full_name (el admin completa
-- la contrata desde /admin/usuarios).
update public.profiles
set nombre   = split_part(trim(full_name), ' ', 1),
    apellido = trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1))
where nombre = '' and apellido = '' and trim(full_name) <> '';

-- Cuentas de Auth sin perfil (quedaron del saneamiento anterior): se crean
-- activas para que no queden bloqueadas por las políticas restrictivas.
insert into public.profiles (id, email, username, full_name, role, estado)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'username', split_part(coalesce(u.email, ''), '@', 1)),
       coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, ''), '@', 1), ''),
       'user', 'activo'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- 2. Trigger de alta ---------------------------------------------------------
-- Registro desde la app = metadata con "legajo". Se valida y la cuenta entra
-- como 'pendiente'. Cuentas creadas desde el panel de Supabase (sin legajo en
-- el metadata) siguen entrando 'activo' como hasta ahora.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  m          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_registro boolean := (m ? 'legajo');
  v_nombre   text := trim(coalesce(m ->> 'nombre', ''));
  v_apellido text := trim(coalesce(m ->> 'apellido', ''));
  v_contrata text := upper(trim(coalesce(m ->> 'contrata', '')));
  v_legajo   text := upper(regexp_replace(coalesce(m ->> 'legajo', ''), '\s+', '', 'g'));
  v_base     text;
  v_username text;
  v_n        integer := 0;
begin
  if v_registro then
    if v_nombre = '' or v_apellido = '' then
      raise exception 'NOMBRE_OBLIGATORIO';
    end if;
    if v_contrata not in ('IDERKA', 'FONTA') then
      raise exception 'CONTRATA_INVALIDA';
    end if;
    if v_legajo !~ '^PE[0-9]{3}[LR][0-9]+$' then
      raise exception 'LEGAJO_INVALIDO';
    end if;
    v_base := lower(v_legajo);
  else
    v_base := coalesce(m ->> 'username', split_part(coalesce(new.email, ''), '@', 1));
  end if;

  -- username único: si ya existe se agrega un sufijo numérico
  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_n := v_n + 1;
    v_username := v_base || v_n::text;
  end loop;

  insert into public.profiles
    (id, email, username, full_name, nombre, apellido, contrata, legajo, role, estado)
  values (
    new.id,
    new.email,
    v_username,
    case when v_registro then v_nombre || ' ' || v_apellido
         else coalesce(m ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), '') end,
    v_nombre,
    v_apellido,
    nullif(v_contrata, ''),
    v_legajo,
    'user',
    case when v_registro then 'pendiente' else 'activo' end
  );
  return new;
end;
$$;

-- 3. Utilidades de registro / clave -----------------------------------------

-- Pre-chequeo desde la pantalla de registro (anon). Expone lo mismo que
-- profiles, que ya es legible públicamente.
create or replace function public.legajo_disponible(p_legajo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where legajo <> ''
      and upper(legajo) = upper(regexp_replace(coalesce(p_legajo, ''), '\s+', '', 'g'))
  );
$$;
grant execute on function public.legajo_disponible(text) to anon, authenticated;

-- El usuario no puede actualizar su propio perfil; esta función solo limpia
-- la marca de "clave reiniciada" cuando termina de crear la nueva clave.
create or replace function public.completar_cambio_clave()
returns void
language sql security definer set search_path = public
as $$
  update public.profiles set clave_reiniciada_en = null where id = auth.uid();
$$;
revoke all on function public.completar_cambio_clave() from public, anon;
grant execute on function public.completar_cambio_clave() to authenticated;

-- Solo la Edge Function (service_role) cierra sesiones de otro usuario.
create or replace function public.admin_cerrar_sesiones(p_user uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from auth.sessions where user_id = p_user;
$$;
revoke all on function public.admin_cerrar_sesiones(uuid) from public, anon, authenticated;
grant execute on function public.admin_cerrar_sesiones(uuid) to service_role;

-- 4. Bloqueo en el servidor --------------------------------------------------

create or replace function public.usuario_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and estado = 'activo'
  );
$$;

-- Las políticas RESTRICTIVE se combinan con AND con las permisivas existentes:
-- una cuenta pendiente o suspendida no lee ni escribe nada, aunque su token
-- siga vigente.
do $$
declare
  t text;
begin
  foreach t in array array[
    'repuestos', 'spare_part_lists', 'spare_part_list_items',
    'warehouse_items', 'warehouse_transactions',
    'pedidos', 'pedido_items', 'pedidos_personas',
    'workorders', 'preferencias_usuario'
  ] loop
    -- Se omiten las tablas que aún no existen en esta base; si se crean
    -- después, vuelve a ejecutar este bloque.
    if to_regclass('public.' || t) is null then
      raise notice 'Tabla public.% no existe: se omite', t;
      continue;
    end if;
    execute format('drop policy if exists "solo_cuentas_activas" on public.%I', t);
    execute format(
      'create policy "solo_cuentas_activas" on public.%I as restrictive for all to authenticated using (public.usuario_activo()) with check (public.usuario_activo())',
      t
    );
  end loop;
end $$;

-- Las RPC de inventario son security definer (saltan RLS): las cubre este
-- trigger, que corre en cualquier escritura de stock. Sin usuario (service
-- role / SQL editor) no bloquea.
create or replace function public._exigir_cuenta_activa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.usuario_activo() then
    raise exception 'CUENTA_INACTIVA';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists exigir_cuenta_activa on public.warehouse_items;
create trigger exigir_cuenta_activa
  before insert or update or delete on public.warehouse_items
  for each row execute function public._exigir_cuenta_activa();

drop trigger if exists exigir_cuenta_activa on public.warehouse_transactions;
create trigger exigir_cuenta_activa
  before insert or update or delete on public.warehouse_transactions
  for each row execute function public._exigir_cuenta_activa();

-- 5. Un usuario no puede tocar estado/rol/etc. de su perfil -------------------
-- Ya garantizado: profiles solo tiene políticas de escritura para admin.
-- Verificación sugerida tras aplicar:
--   select policyname, cmd from pg_policies where tablename = 'profiles';

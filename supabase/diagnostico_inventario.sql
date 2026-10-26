-- +--------------------------------------------------+
-- |   Diagnóstico de inventario (SOLO LECTURA)       |
-- |   Paso 0 del plan de inventario confiable        |
-- +--------------------------------------------------+
-- No es una migración: no modifica datos. Ejecutar en el SQL Editor de
-- Supabase (corre como postgres, así que ve los datos de todos los CE).
-- Convención actual del historial: IN y OUT con cantidad positiva;
-- ADJUSTMENT no se usa todavía.

-- 0. Resumen: cuántos casos hay de cada problema
with
listas_dup as (
  select source_id, part_number
  from public.warehouse_transactions
  where source_type = 'LIST' and type = 'OUT'
  group by source_id, part_number
  having count(*) > 1
),
recepciones_dup as (
  select source_id, part_number
  from public.warehouse_transactions
  where source_type = 'ORDER' and type = 'IN'
  group by source_id, part_number
  having count(*) > 1
),
historial as (
  select user_id, part_number,
    sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end) as saldo
  from public.warehouse_transactions
  group by user_id, part_number
),
diferencias as (
  select 1
  from public.warehouse_items wi
  full outer join historial h on h.user_id = wi.user_id and h.part_number = wi.part_number
  where coalesce(wi.quantity, 0) <> coalesce(h.saldo, 0)
)
select 'Listas descontadas más de una vez (lista × repuesto)' as problema, count(*) as casos from listas_dup
union all
select 'Recepciones duplicadas (pedido × repuesto)', count(*) from recepciones_dup
union all
select 'Pedidos guardados con entradas ya registradas (recepción a medias)', count(distinct p.id)
  from public.pedidos p
  join public.warehouse_transactions t on t.source_type = 'ORDER' and t.source_id = p.id
  where p.estado = 'guardado'
union all
select 'Diferencias stock vs historial (CE × repuesto)', count(*) from diferencias
union all
select 'Stock negativo', count(*) from public.warehouse_items where quantity < 0
union all
select 'Part numbers repetidos en el catálogo de repuestos', count(*)
  from (select part_number from public.repuestos
        where coalesce(trim(part_number), '') <> ''
        group by part_number having count(*) > 1) x
union all
select 'Repuestos sin part number usados en pedidos', count(distinct r.id)
  from public.pedido_items pi
  join public.repuestos r on r.id = pi.spare_part_id
  where coalesce(trim(r.part_number), '') = '';


-- 1. Listas descontadas más de una vez (re-sincronización)
--    "veces" > 1 => el mismo consumo se restó varias veces del almacén.
select
  coalesce(pr.username, pr.email) as ce,
  l.name as lista,
  l.work_order as wo,
  t.part_number,
  count(*) as veces,
  sum(t.quantity) as total_descontado,
  (select sum(li.quantity)
     from public.spare_part_list_items li
     join public.repuestos r on r.id = li.spare_part_id
    where li.list_id = t.source_id and r.part_number = t.part_number) as cantidad_actual_en_lista,
  min(t.created_at) as primera,
  max(t.created_at) as ultima
from public.warehouse_transactions t
left join public.spare_part_lists l on l.id = t.source_id
left join public.profiles pr on pr.id = t.user_id
where t.source_type = 'LIST' and t.type = 'OUT'
group by pr.username, pr.email, l.name, l.work_order, t.source_id, t.part_number
having count(*) > 1
order by ultima desc;


-- 2. Recepciones duplicadas (bloquean el índice único de la migración A)
select
  coalesce(pr.username, pr.email) as ce,
  p.wo,
  p.estado,
  t.part_number,
  count(*) as veces,
  sum(t.quantity) as total_ingresado,
  min(t.created_at) as primera,
  max(t.created_at) as ultima
from public.warehouse_transactions t
left join public.pedidos p on p.id = t.source_id
left join public.profiles pr on pr.id = t.user_id
where t.source_type = 'ORDER' and t.type = 'IN'
group by pr.username, pr.email, p.wo, p.estado, t.part_number
having count(*) > 1
order by ultima desc;


-- 3. Pedidos con recepción incompleta o inconsistente
--    a) estado 'guardado' pero ya hay entradas en almacén (falló a mitad)
--    b) estado 'recepcionado' pero lo ingresado no coincide con el pedido
with pedido_esperado as (
  select pi.pedido_id, r.part_number, sum(pi.quantity) as esperado
  from public.pedido_items pi
  join public.repuestos r on r.id = pi.spare_part_id
  group by pi.pedido_id, r.part_number
),
pedido_ingresado as (
  select source_id as pedido_id, part_number, sum(quantity) as ingresado
  from public.warehouse_transactions
  where source_type = 'ORDER' and type = 'IN'
  group by source_id, part_number
),
claves as (
  select pedido_id, part_number from pedido_esperado
  union
  select pedido_id, part_number from pedido_ingresado
)
select
  coalesce(pr.username, pr.email) as ce,
  p.wo,
  p.estado,
  k.part_number,
  coalesce(e.esperado, 0) as esperado,
  coalesce(i.ingresado, 0) as ingresado,
  p.recepcionado_at
from claves k
join public.pedidos p on p.id = k.pedido_id
left join pedido_esperado e on e.pedido_id = k.pedido_id and e.part_number = k.part_number
left join pedido_ingresado i on i.pedido_id = k.pedido_id and i.part_number = k.part_number
left join public.profiles pr on pr.id = p.user_id
where (p.estado = 'guardado' and coalesce(i.ingresado, 0) > 0)
   or (p.estado = 'recepcionado' and coalesce(e.esperado, 0) <> coalesce(i.ingresado, 0))
order by p.created_at desc;


-- 4. Diferencias entre stock y historial por CE y repuesto
--    diferencia > 0: hay más stock del que justifica el historial
--    diferencia < 0: falta stock respecto al historial
--    (causas típicas: retiros recortados a 0, transacciones que fallaron,
--     historial borrado al eliminar un repuesto)
with historial as (
  select user_id, part_number,
    sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end) as saldo,
    count(*) as movimientos
  from public.warehouse_transactions
  group by user_id, part_number
)
select
  coalesce(pr.username, pr.email) as ce,
  coalesce(wi.part_number, h.part_number) as part_number,
  coalesce(wi.quantity, 0) as stock,
  coalesce(h.saldo, 0) as saldo_historial,
  coalesce(wi.quantity, 0) - coalesce(h.saldo, 0) as diferencia,
  coalesce(h.movimientos, 0) as movimientos,
  case when wi.id is null then 'Sin fila de stock' when h.part_number is null then 'Sin historial' else '' end as nota
from public.warehouse_items wi
full outer join historial h on h.user_id = wi.user_id and h.part_number = wi.part_number
left join public.profiles pr on pr.id = coalesce(wi.user_id, h.user_id)
where coalesce(wi.quantity, 0) <> coalesce(h.saldo, 0)
order by ce, part_number;


-- 5. Listas sincronizadas que se editaron después de descontar
--    (lo que dice la lista hoy ya no coincide con lo que se restó)
with descontado as (
  select source_id as list_id, part_number, sum(quantity) as descontado
  from public.warehouse_transactions
  where source_type = 'LIST' and type = 'OUT'
  group by source_id, part_number
),
en_lista as (
  select li.list_id, r.part_number, sum(li.quantity) as en_lista
  from public.spare_part_list_items li
  join public.repuestos r on r.id = li.spare_part_id
  group by li.list_id, r.part_number
),
claves as (
  select list_id, part_number from en_lista
  union
  select list_id, part_number from descontado
)
select
  coalesce(pr.username, pr.email) as ce,
  l.name as lista,
  l.work_order as wo,
  k.part_number,
  coalesce(e.en_lista, 0) as en_lista,
  coalesce(d.descontado, 0) as descontado,
  l.inventory_synced_at
from claves k
join public.spare_part_lists l on l.id = k.list_id
left join en_lista e on e.list_id = k.list_id and e.part_number = k.part_number
left join descontado d on d.list_id = k.list_id and d.part_number = k.part_number
left join public.profiles pr on pr.id = l.user_id
where l.inventory_synced
  and coalesce(e.en_lista, 0) <> coalesce(d.descontado, 0)
order by l.inventory_synced_at desc;


-- 6. Stock negativo (no debería existir)
select coalesce(pr.username, pr.email) as ce, wi.part_number, wi.quantity
from public.warehouse_items wi
left join public.profiles pr on pr.id = wi.user_id
where wi.quantity < 0;


-- 7. Part numbers repetidos en el catálogo y repuestos sin part number
--    (el almacén se identifica por part number: estos casos rompen el cruce)
select 'Repetido' as tipo, part_number, count(*) as repuestos, string_agg(nombre, ' | ') as nombres
from public.repuestos
where coalesce(trim(part_number), '') <> ''
group by part_number
having count(*) > 1
union all
select 'Sin part number', '', count(*), string_agg(nombre, ' | ')
from public.repuestos
where coalesce(trim(part_number), '') = ''
having count(*) > 0;


-- 8. Seguimiento de la consulta 5 (casos encontrados el 2026-10-26)
--    Part numbers: 0090035910, 2881090903, 6039009222, 4450773447

-- 8a. ¿Queda historial de estos part numbers? Si 0090035910 no tiene
--     ninguna transacción, su historial se borró al eliminarlo del almacén.
select t.part_number, t.type, t.source_type, l.name as lista, t.work_order,
       t.quantity, t.created_at
from public.warehouse_transactions t
left join public.spare_part_lists l on l.id = t.source_id
where t.part_number in ('0090035910', '2881090903', '6039009222', '4450773447')
order by t.part_number, t.created_at;

-- 8b. Stock actual de esos part numbers
select part_number, quantity, created_at, updated_at
from public.warehouse_items
where part_number in ('0090035910', '2881090903', '6039009222', '4450773447');

-- 8c. Items de las listas afectadas: agregado_despues = true indica que
--     el repuesto se agregó a la lista después de sincronizarla
select l.name as lista, r.part_number, r.nombre, li.quantity,
       li.created_at as item_creado, l.inventory_synced_at,
       li.created_at > l.inventory_synced_at as agregado_despues
from public.spare_part_lists l
join public.spare_part_list_items li on li.list_id = l.id
left join public.repuestos r on r.id = li.spare_part_id
where l.name in ('C111272', 'C194781', 'BNAC2362', 'C193284', 'C193112', 'I0004666')
order by l.inventory_synced_at, l.name;

-- 8d. Catálogo: ¿existen estos part numbers y cuántas veces?
select part_number, nombre, id
from public.repuestos
where part_number in ('0090035910', '2881090903', '6039009222', '4450773447');

-- 8e. ¿Por qué "ce" sale vacío? Dueño de las listas y su perfil
select distinct l.user_id, p.id as profile_id, p.username, p.email
from public.spare_part_lists l
left join public.profiles p on p.id = l.user_id
where l.name in ('C111272', 'C194781', 'BNAC2362', 'C193284', 'C193112', 'I0004666');

-- 8f. Usuarios sin perfil (8e mostró uno: 41606918-f032-43ed-96b1-18bf53f09752)
--     Sus listas existen, así que el usuario sigue en auth.users
--     (las listas se borran en cascada si se elimina el usuario).
select u.id, u.email, u.raw_user_meta_data ->> 'username' as username_meta,
       u.created_at, u.last_sign_in_at,
       (select count(*) from public.profiles p2
         where p2.username = split_part(coalesce(u.email, ''), '@', 1)) as username_ya_usado
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Corrección (ESCRIBE DATOS: ejecutar solo después de revisar 8f).
-- Crea el perfil faltante igual que el trigger handle_new_user. Si
-- username_ya_usado > 0, cambia el username antes de ejecutarlo.
-- insert into public.profiles (id, email, username, full_name, role)
-- select u.id, u.email,
--        coalesce(u.raw_user_meta_data ->> 'username', split_part(coalesce(u.email, ''), '@', 1)),
--        coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, ''), '@', 1), ''),
--        'user'
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null
-- on conflict (id) do nothing;

-- 8g. ¿Se aplicó completa la migración 20260620_add_profiles_and_role_rls.sql?
--     8f mostró 2 cuentas sin perfil, ambas creadas antes de esa migración,
--     cuyo backfill debió crearles el perfil.
select role, count(*) as perfiles from public.profiles group by role;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('repuestos', 'spare_part_lists', 'profiles',
                    'warehouse_items', 'warehouse_transactions')
order by tablename, policyname;

select tgname from pg_trigger where tgname = 'on_auth_user_created';

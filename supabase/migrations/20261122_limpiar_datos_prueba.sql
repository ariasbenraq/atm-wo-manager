-- Limpieza ÚNICA de datos de prueba de Pedidos y Mis listas de repuestos.
-- Elimina los registros de:
--   a) el técnico con legajo PE101L84, y
--   b) cuentas SIN legajo (profiles.legajo vacío o sin perfil), excepto administradores.
-- Tablas afectadas: pedidos (+ pedido_items) y spare_part_lists (+ spare_part_list_items);
-- los ítems se borran en cascada. Es idempotente.
--
-- No toca el almacén (warehouse_items / warehouse_transactions, historial solo anexado):
--   * pedidos recepcionados: el stock que sumaron y su lista «Uso de repuestos - …» se
--     conservan (esa lista se elimina aquí si pertenece a los usuarios afectados).
--   * listas ya sincronizadas con el almacén (inventory_synced): el stock que descontaron
--     NO se devuelve. Ninguna tabla del almacén referencia a pedidos ni a listas, así que
--     el borrado no rompe `v_stock_diferencias`.

do $$
declare
  v_pedidos int;
  v_pedidos_items int;
  v_recepcionados int;
  v_listas int;
  v_listas_items int;
  v_sincronizadas int;
begin
  create temporary table _usuarios_prueba on commit drop as
  select p.id
  from public.profiles p
  where upper(regexp_replace(coalesce(p.legajo, ''), '\s', '', 'g')) = 'PE101L84'
     or (btrim(coalesce(p.legajo, '')) = '' and coalesce(p.role, '') <> 'admin');

  -- Cuentas sin perfil (user_id sin fila en profiles)
  insert into _usuarios_prueba
  select distinct x.user_id
  from (
    select user_id from public.pedidos
    union select user_id from public.spare_part_lists
  ) x
  where not exists (select 1 from public.profiles p where p.id = x.user_id)
    and not exists (select 1 from _usuarios_prueba t where t.id = x.user_id);

  -- Pedidos
  select count(*), count(*) filter (where estado = 'recepcionado')
    into v_pedidos, v_recepcionados
  from public.pedidos where user_id in (select id from _usuarios_prueba);
  select count(*) into v_pedidos_items from public.pedido_items
  where pedido_id in (select id from public.pedidos where user_id in (select id from _usuarios_prueba));
  delete from public.pedidos where user_id in (select id from _usuarios_prueba);

  -- Mis listas de repuestos
  select count(*), count(*) filter (where inventory_synced)
    into v_listas, v_sincronizadas
  from public.spare_part_lists where user_id in (select id from _usuarios_prueba);
  select count(*) into v_listas_items from public.spare_part_list_items
  where list_id in (select id from public.spare_part_lists where user_id in (select id from _usuarios_prueba));
  delete from public.spare_part_lists where user_id in (select id from _usuarios_prueba);

  raise notice 'Pedidos eliminados: % (ítems: %, recepcionados: %)', v_pedidos, v_pedidos_items, v_recepcionados;
  raise notice 'Listas eliminadas: % (ítems: %, sincronizadas con el almacén: %)', v_listas, v_listas_items, v_sincronizadas;
end $$;

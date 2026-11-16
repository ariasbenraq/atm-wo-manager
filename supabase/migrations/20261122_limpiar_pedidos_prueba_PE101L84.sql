-- Limpieza ÚNICA de datos de prueba en pedidos. Elimina los pedidos de:
--   a) el técnico con legajo PE101L84, y
--   b) cuentas SIN legajo (profiles.legajo vacío o sin perfil), excepto administradores.
-- Los ítems (pedido_items) se borran en cascada. Es idempotente.
--
-- No toca el almacén: si algún pedido estaba recepcionado, su stock, su historial
-- (warehouse_transactions, solo anexado) y la lista «Uso de repuestos - …» se conservan.
-- Ninguna tabla del almacén referencia a `pedidos`, así que el borrado es seguro.

do $$
declare
  v_pedidos int;
  v_items int;
  v_recepcionados int;
begin
  create temporary table _pedidos_borrar on commit drop as
  select p.id, p.estado
  from public.pedidos p
  left join public.profiles u on u.id = p.user_id
  where upper(regexp_replace(coalesce(u.legajo, ''), '\s', '', 'g')) = 'PE101L84'
     or (
       btrim(coalesce(u.legajo, '')) = ''
       and coalesce(u.role, '') <> 'admin'
     );

  select count(*) into v_pedidos from _pedidos_borrar;
  select count(*) into v_recepcionados from _pedidos_borrar where estado = 'recepcionado';
  select count(*) into v_items from public.pedido_items where pedido_id in (select id from _pedidos_borrar);

  delete from public.pedidos where id in (select id from _pedidos_borrar);

  raise notice 'Pedidos eliminados: % (ítems: %, de ellos recepcionados: %)',
    v_pedidos, v_items, v_recepcionados;
end $$;

-- Limpieza ÚNICA de datos de prueba: elimina todos los pedidos del técnico con legajo
-- PE101L84. Los ítems (pedido_items) se borran en cascada. Es idempotente: si ya no hay
-- pedidos de ese legajo, no hace nada.
--
-- No toca el almacén: si algún pedido estaba recepcionado, su stock y su historial
-- (warehouse_transactions, solo anexado) y la lista «Uso de repuestos - …» se conservan.
-- Ninguna tabla del almacén referencia a `pedidos`, así que el borrado es seguro.

do $$
declare
  v_pedidos int;
  v_items int;
  v_recepcionados int;
begin
  select count(*) into v_pedidos
  from public.pedidos p join public.profiles u on u.id = p.user_id
  where upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84';

  select count(*) into v_items
  from public.pedido_items i
  join public.pedidos p on p.id = i.pedido_id
  join public.profiles u on u.id = p.user_id
  where upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84';

  select count(*) into v_recepcionados
  from public.pedidos p join public.profiles u on u.id = p.user_id
  where upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84'
    and p.estado = 'recepcionado';

  delete from public.pedidos p
  using public.profiles u
  where u.id = p.user_id
    and upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84';

  raise notice 'Pedidos eliminados: % (ítems: %, de ellos recepcionados: %)',
    v_pedidos, v_items, v_recepcionados;
end $$;

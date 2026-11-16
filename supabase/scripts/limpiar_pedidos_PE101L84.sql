-- Limpieza ÚNICA: elimina los pedidos de prueba del técnico con legajo PE101L84.
-- NO es una migración: ejecútalo a mano en el SQL Editor de Supabase (rol postgres),
-- paso a paso. Solo toca `pedidos` (y `pedido_items`, que se borran en cascada).

-- 1) VISTA PREVIA: qué se borraría ------------------------------------------------
select p.id, p.estado, p.wo, p.site, p.created_at,
       (select count(*) from public.pedido_items i where i.pedido_id = p.id) as items
from public.pedidos p
join public.profiles u on u.id = p.user_id
where upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84'
order by p.created_at;

-- 2) ¿HAY PEDIDOS YA RECEPCIONADOS? ------------------------------------------------
-- Recepcionar sumó stock al almacén (warehouse_transactions IN/ORDER) y creó una lista
-- «Uso de repuestos - …». Borrar el pedido NO revierte eso. Si el conteo es > 0, mira
-- la nota del final antes de seguir.
select count(*) as recepcionados
from public.pedidos p
join public.profiles u on u.id = p.user_id
where upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84'
  and p.estado = 'recepcionado';

-- 3) BORRADO (transacción: revisa el conteo y luego COMMIT o ROLLBACK) --------------
begin;

delete from public.pedidos p
using public.profiles u
where u.id = p.user_id
  and upper(regexp_replace(u.legajo, '\s', '', 'g')) = 'PE101L84'
returning p.id, p.estado, p.wo;

-- Si el resultado es el esperado:  commit;
-- Si no:                           rollback;

-- NOTA (solo si había recepcionados): el stock y el historial del almacén NO se tocan
-- aquí porque el historial es de solo anexado y `v_stock_diferencias` debe seguir vacío.
-- Para dejar el almacén limpio, usa los RPC (`ajustar_stock` / `fijar_stock`) o borra las
-- listas «Uso de repuestos - …» con `revertir_consumo_lista`; pídemelo y lo preparo.

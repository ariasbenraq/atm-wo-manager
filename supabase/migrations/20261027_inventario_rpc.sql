-- +--------------------------------------------------+
-- |   Inventario confiable — Migración A             |
-- +--------------------------------------------------+
-- Todo movimiento de stock pasa por funciones que se aplican completas o
-- no se aplican, validan dueño o admin y bloquean las filas que tocan.
-- Compatible con la app actual: no quita permisos de escritura directa
-- (eso lo hace la migración B, después de publicar la app nueva).
--
-- Convención del historial (warehouse_transactions.quantity):
--   IN y OUT siempre positivos; ADJUSTMENT con signo.
--   Stock = Σ IN − Σ OUT + Σ ADJUSTMENT
--
-- Errores: las funciones lanzan excepciones con un código en el mensaje
-- (p. ej. 'STOCK_INSUFICIENTE:<pn>') que la app traduce a español.

-- 1. Columnas de auditoría en el historial
alter table public.warehouse_transactions
  add column if not exists motivo text not null default '',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists balance_after integer;

-- 2. Stock nunca negativo
alter table public.warehouse_items
  drop constraint if exists warehouse_items_quantity_no_negativa;
alter table public.warehouse_items
  add constraint warehouse_items_quantity_no_negativa check (quantity >= 0);

-- 3. Un pedido ingresa cada part number una sola vez
create unique index if not exists warehouse_tx_order_unique
  on public.warehouse_transactions (source_id, part_number)
  where source_type = 'ORDER' and type = 'IN';

-- 4. Lectura del almacén para admin (reportes); se suma a la política del dueño
drop policy if exists "Admin ve inventario" on public.warehouse_items;
create policy "Admin ve inventario"
  on public.warehouse_items for select
  using (public.is_admin());

drop policy if exists "Admin ve historial de inventario" on public.warehouse_transactions;
create policy "Admin ve historial de inventario"
  on public.warehouse_transactions for select
  using (public.is_admin());


-- 5. Helpers internos (sin acceso desde la app)

create or replace function public._puede_operar(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (auth.uid() = p_owner or public.is_admin());
$$;

-- Aplica un movimiento: actualiza el stock (bloqueando la fila) y registra
-- la transacción con el saldo resultante. Devuelve el nuevo saldo.
create or replace function public._mover_stock(
  p_user uuid,
  p_pn text,
  p_delta integer,
  p_type text,
  p_source_type text,
  p_source_id uuid,
  p_site text,
  p_wo text,
  p_motivo text
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_saldo integer;
begin
  if coalesce(p_delta, 0) = 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;
  if (p_type = 'IN' and p_delta < 0) or (p_type = 'OUT' and p_delta > 0) then
    raise exception 'TIPO_INVALIDO';
  end if;

  if p_delta > 0 then
    insert into public.warehouse_items (user_id, part_number, quantity)
    values (p_user, p_pn, p_delta)
    on conflict (user_id, part_number) do update
      set quantity = public.warehouse_items.quantity + excluded.quantity,
          updated_at = now()
    returning quantity into v_saldo;
  else
    -- Restar con update: el check de stock >= 0 se evalúa sobre la fila
    -- propuesta de un insert, así que "insert ... on conflict" con delta
    -- negativo fallaría siempre.
    begin
      update public.warehouse_items
      set quantity = quantity + p_delta, updated_at = now()
      where user_id = p_user and part_number = p_pn
      returning quantity into v_saldo;
    exception when check_violation then
      raise exception 'STOCK_INSUFICIENTE:%', p_pn;
    end;
    if v_saldo is null then
      raise exception 'STOCK_INSUFICIENTE:%', p_pn;
    end if;
  end if;

  insert into public.warehouse_transactions (
    user_id, part_number, quantity, type, source_type, source_id,
    site, work_order, motivo, created_by, balance_after
  ) values (
    p_user, p_pn,
    case when p_type = 'ADJUSTMENT' then p_delta else abs(p_delta) end,
    p_type, p_source_type, p_source_id,
    coalesce(p_site, ''), coalesce(p_wo, ''), coalesce(p_motivo, ''),
    auth.uid(), v_saldo
  );

  return v_saldo;
end;
$$;


-- 6. Movimientos manuales desde Almacén (siempre sobre el usuario actual)

create or replace function public.ajustar_stock(
  p_part_number text,
  p_tipo text,
  p_cantidad integer,
  p_motivo text default '',
  p_wo text default '',
  p_site text default ''
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pn text := trim(coalesce(p_part_number, ''));
  v_saldo integer;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if v_pn = '' then raise exception 'PART_NUMBER_REQUERIDO'; end if;
  if p_tipo not in ('IN', 'OUT') then raise exception 'TIPO_INVALIDO'; end if;
  if coalesce(p_cantidad, 0) < 1 then raise exception 'CANTIDAD_INVALIDA'; end if;

  v_saldo := public._mover_stock(
    auth.uid(), v_pn,
    case when p_tipo = 'IN' then p_cantidad else -p_cantidad end,
    p_tipo, 'WAREHOUSE', null, p_site, p_wo, p_motivo
  );

  return json_build_object('part_number', v_pn, 'quantity', v_saldo);
end;
$$;

-- Corrige el stock a una cantidad exacta (conteo físico) con un ADJUSTMENT
create or replace function public.fijar_stock(
  p_part_number text,
  p_cantidad integer,
  p_motivo text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pn text := trim(coalesce(p_part_number, ''));
  v_actual integer;
  v_saldo integer;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if v_pn = '' then raise exception 'PART_NUMBER_REQUERIDO'; end if;
  if p_cantidad is null or p_cantidad < 0 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if trim(coalesce(p_motivo, '')) = '' then raise exception 'MOTIVO_REQUERIDO'; end if;

  select quantity into v_actual
  from public.warehouse_items
  where user_id = auth.uid() and part_number = v_pn
  for update;

  if coalesce(v_actual, 0) = p_cantidad then
    return json_build_object('part_number', v_pn, 'quantity', p_cantidad);
  end if;

  v_saldo := public._mover_stock(
    auth.uid(), v_pn, p_cantidad - coalesce(v_actual, 0),
    'ADJUSTMENT', 'WAREHOUSE', null, '', '', trim(p_motivo)
  );

  return json_build_object('part_number', v_pn, 'quantity', v_saldo);
end;
$$;

-- Quita un repuesto del almacén solo si está en 0; el historial se conserva
create or replace function public.eliminar_item_almacen(p_part_number text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pn text := trim(coalesce(p_part_number, ''));
  v_actual integer;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;

  select quantity into v_actual
  from public.warehouse_items
  where user_id = auth.uid() and part_number = v_pn
  for update;

  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if v_actual <> 0 then raise exception 'STOCK_NO_CERO'; end if;

  delete from public.warehouse_items
  where user_id = auth.uid() and part_number = v_pn;
end;
$$;


-- 7. Recepción de pedido: IN al almacén del dueño + lista de uso + estado

create or replace function public.recepcionar_pedido(
  p_pedido_id uuid,
  p_recepcionado_por_id uuid default null,
  p_entregado_por_id uuid default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_lista public.spare_part_lists%rowtype;
  v_sin_pn text;
  v_item record;
  v_items integer;
  v_rec_nombre text;
  v_ent_nombre text;
  v_ahora timestamptz := now();
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if not public._puede_operar(v_pedido.user_id) then raise exception 'SIN_PERMISO'; end if;
  if v_pedido.estado = 'recepcionado' then raise exception 'PEDIDO_YA_RECEPCIONADO'; end if;

  select count(*) into v_items from public.pedido_items where pedido_id = p_pedido_id;
  if v_items = 0 then raise exception 'PEDIDO_SIN_ITEMS'; end if;

  select string_agg(r.nombre, ', ') into v_sin_pn
  from public.pedido_items pi
  join public.repuestos r on r.id = pi.spare_part_id
  where pi.pedido_id = p_pedido_id and trim(coalesce(r.part_number, '')) = '';
  if v_sin_pn is not null then raise exception 'REPUESTO_SIN_PN:%', v_sin_pn; end if;

  for v_item in
    select trim(r.part_number) as pn, sum(pi.quantity)::integer as qty
    from public.pedido_items pi
    join public.repuestos r on r.id = pi.spare_part_id
    where pi.pedido_id = p_pedido_id
    group by trim(r.part_number)
  loop
    perform public._mover_stock(
      v_pedido.user_id, v_item.pn, v_item.qty,
      'IN', 'ORDER', v_pedido.id, v_pedido.site, v_pedido.wo, 'Recepción de pedido'
    );
  end loop;

  insert into public.spare_part_lists (user_id, name, site, work_order)
  values (
    v_pedido.user_id,
    'Uso de repuestos - ' || coalesce(nullif(v_pedido.wo, ''), left(v_pedido.id::text, 8)),
    v_pedido.site,
    v_pedido.wo
  )
  returning * into v_lista;

  insert into public.spare_part_list_items (list_id, spare_part_id, quantity)
  select v_lista.id, spare_part_id, quantity
  from public.pedido_items
  where pedido_id = p_pedido_id;

  select nombre into v_rec_nombre from public.pedidos_personas where id = p_recepcionado_por_id;
  select nombre into v_ent_nombre from public.pedidos_personas where id = p_entregado_por_id;

  update public.pedidos
  set estado = 'recepcionado',
      recepcionado_por_id = case when v_rec_nombre is null then null else p_recepcionado_por_id end,
      recepcionado_por_nombre = coalesce(v_rec_nombre, ''),
      entregado_por_id = case when v_ent_nombre is null then null else p_entregado_por_id end,
      entregado_por_nombre = coalesce(v_ent_nombre, ''),
      recepcionado_at = v_ahora,
      updated_at = v_ahora
  where id = p_pedido_id;

  return json_build_object(
    'lista', row_to_json(v_lista),
    'item_count', v_items,
    'recepcionado_at', v_ahora,
    'recepcionado_por_nombre', coalesce(v_rec_nombre, ''),
    'entregado_por_nombre', coalesce(v_ent_nombre, '')
  );
end;
$$;


-- 8. Consumo de lista: OUT por cada repuesto, una sola vez

create or replace function public.consumir_lista(p_list_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_lista public.spare_part_lists%rowtype;
  v_sin_pn text;
  v_faltantes json;
  v_item record;
  v_ahora timestamptz := now();
begin
  select * into v_lista from public.spare_part_lists where id = p_list_id for update;
  if not found then raise exception 'LISTA_NO_ENCONTRADA'; end if;
  if not public._puede_operar(v_lista.user_id) then raise exception 'SIN_PERMISO'; end if;
  if v_lista.inventory_synced then raise exception 'LISTA_YA_SINCRONIZADA'; end if;

  if not exists (select 1 from public.spare_part_list_items where list_id = p_list_id) then
    raise exception 'LISTA_SIN_ITEMS';
  end if;

  select string_agg(r.nombre, ', ') into v_sin_pn
  from public.spare_part_list_items li
  join public.repuestos r on r.id = li.spare_part_id
  where li.list_id = p_list_id and trim(coalesce(r.part_number, '')) = '';
  if v_sin_pn is not null then raise exception 'REPUESTO_SIN_PN:%', v_sin_pn; end if;

  -- Bloquear el stock involucrado antes de validar
  perform 1
  from public.warehouse_items w
  where w.user_id = v_lista.user_id
    and w.part_number in (
      select trim(r.part_number)
      from public.spare_part_list_items li
      join public.repuestos r on r.id = li.spare_part_id
      where li.list_id = p_list_id
    )
  for update;

  select json_agg(json_build_object(
           'part_number', n.pn,
           'requerido', n.qty,
           'disponible', coalesce(w.quantity, 0)
         ))
  into v_faltantes
  from (
    select trim(r.part_number) as pn, sum(coalesce(li.quantity, 1))::integer as qty
    from public.spare_part_list_items li
    join public.repuestos r on r.id = li.spare_part_id
    where li.list_id = p_list_id
    group by trim(r.part_number)
  ) n
  left join public.warehouse_items w
    on w.user_id = v_lista.user_id and w.part_number = n.pn
  where coalesce(w.quantity, 0) < n.qty;

  if v_faltantes is not null then
    return json_build_object('ok', false, 'faltantes', v_faltantes);
  end if;

  for v_item in
    select trim(r.part_number) as pn, sum(coalesce(li.quantity, 1))::integer as qty
    from public.spare_part_list_items li
    join public.repuestos r on r.id = li.spare_part_id
    where li.list_id = p_list_id
    group by trim(r.part_number)
  loop
    perform public._mover_stock(
      v_lista.user_id, v_item.pn, -v_item.qty,
      'OUT', 'LIST', v_lista.id, v_lista.site, v_lista.work_order, 'Consumo de lista'
    );
  end loop;

  update public.spare_part_lists
  set inventory_synced = true, inventory_synced_at = v_ahora, updated_at = v_ahora
  where id = p_list_id;

  return json_build_object('ok', true, 'synced_at', v_ahora);
end;
$$;

-- Devuelve al almacén lo que la lista descontó (según el historial, no según
-- los items actuales) y la deja editable para volver a sincronizar.
create or replace function public.revertir_consumo_lista(p_list_id uuid, p_motivo text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_lista public.spare_part_lists%rowtype;
  v_item record;
  v_ahora timestamptz := now();
begin
  if trim(coalesce(p_motivo, '')) = '' then raise exception 'MOTIVO_REQUERIDO'; end if;

  select * into v_lista from public.spare_part_lists where id = p_list_id for update;
  if not found then raise exception 'LISTA_NO_ENCONTRADA'; end if;
  if not public._puede_operar(v_lista.user_id) then raise exception 'SIN_PERMISO'; end if;
  if not v_lista.inventory_synced then raise exception 'LISTA_NO_SINCRONIZADA'; end if;

  -- Neto descontado por esta lista: OUT menos reversiones previas
  for v_item in
    select part_number as pn,
           sum(case when type = 'OUT' then quantity when type = 'ADJUSTMENT' then -quantity else 0 end)::integer as neto
    from public.warehouse_transactions
    where source_type = 'LIST' and source_id = p_list_id and user_id = v_lista.user_id
    group by part_number
  loop
    if v_item.neto > 0 then
      perform public._mover_stock(
        v_lista.user_id, v_item.pn, v_item.neto,
        'ADJUSTMENT', 'LIST', v_lista.id, v_lista.site, v_lista.work_order,
        'Reversión de lista: ' || trim(p_motivo)
      );
    end if;
  end loop;

  update public.spare_part_lists
  set inventory_synced = false, inventory_synced_at = null, updated_at = v_ahora
  where id = p_list_id;

  return json_build_object('ok', true);
end;
$$;


-- 9. Conciliación: filas donde el stock no coincide con el historial
create or replace view public.v_stock_diferencias
with (security_invoker = true)
as
with historial as (
  select user_id, part_number,
    sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end)::integer as saldo
  from public.warehouse_transactions
  group by user_id, part_number
)
select
  coalesce(wi.user_id, h.user_id) as user_id,
  coalesce(wi.part_number, h.part_number) as part_number,
  coalesce(wi.quantity, 0) as stock,
  coalesce(h.saldo, 0) as saldo_historial,
  coalesce(wi.quantity, 0) - coalesce(h.saldo, 0) as diferencia
from public.warehouse_items wi
full outer join historial h
  on h.user_id = wi.user_id and h.part_number = wi.part_number
where coalesce(wi.quantity, 0) <> coalesce(h.saldo, 0);


-- 10. Permisos de ejecución
revoke all on function public._puede_operar(uuid) from public, anon, authenticated;
revoke all on function public._mover_stock(uuid, text, integer, text, text, uuid, text, text, text) from public, anon, authenticated;

revoke all on function public.ajustar_stock(text, text, integer, text, text, text) from public, anon;
revoke all on function public.fijar_stock(text, integer, text) from public, anon;
revoke all on function public.eliminar_item_almacen(text) from public, anon;
revoke all on function public.recepcionar_pedido(uuid, uuid, uuid) from public, anon;
revoke all on function public.consumir_lista(uuid) from public, anon;
revoke all on function public.revertir_consumo_lista(uuid, text) from public, anon;

grant execute on function public.ajustar_stock(text, text, integer, text, text, text) to authenticated;
grant execute on function public.fijar_stock(text, integer, text) to authenticated;
grant execute on function public.eliminar_item_almacen(text) to authenticated;
grant execute on function public.recepcionar_pedido(uuid, uuid, uuid) to authenticated;
grant execute on function public.consumir_lista(uuid) to authenticated;
grant execute on function public.revertir_consumo_lista(uuid, text) to authenticated;

-- Edición de pedidos ANTES de ser recepcionados (datos de la WO y repuestos/cantidades).
-- Una sola operación atómica: bloquea el pedido, verifica que siga en estado «guardado»
-- (si alguien lo recepcionó mientras se editaba, se rechaza) y reemplaza ítems y datos.
-- Un pedido recepcionado NO se puede editar: ya movió stock al almacén y creó la lista de uso.

create or replace function public.actualizar_pedido(
  p_pedido_id uuid,
  p_wo text,
  p_id_atm text,
  p_site text,
  p_modelo text,
  p_direccion text,
  p_items jsonb
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_ahora timestamptz := now();
  v_faltantes integer;
  v_items integer;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if not public._puede_operar(v_pedido.user_id) then raise exception 'SIN_PERMISO'; end if;
  if v_pedido.estado <> 'guardado' then raise exception 'PEDIDO_NO_EDITABLE'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PEDIDO_SIN_ITEMS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(spare_part_id uuid, quantity integer)
    where x.spare_part_id is null or coalesce(x.quantity, 0) < 1
  ) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  select count(*) into v_faltantes
  from jsonb_to_recordset(p_items) as x(spare_part_id uuid, quantity integer)
  left join public.repuestos r on r.id = x.spare_part_id
  where r.id is null;
  if v_faltantes > 0 then raise exception 'REPUESTO_NO_ENCONTRADO'; end if;

  delete from public.pedido_items where pedido_id = p_pedido_id;

  insert into public.pedido_items (pedido_id, spare_part_id, quantity)
  select p_pedido_id, x.spare_part_id, sum(x.quantity)::integer
  from jsonb_to_recordset(p_items) as x(spare_part_id uuid, quantity integer)
  group by x.spare_part_id;

  update public.pedidos
  set wo = btrim(coalesce(p_wo, '')),
      id_atm = btrim(coalesce(p_id_atm, '')),
      site = btrim(coalesce(p_site, '')),
      modelo = btrim(coalesce(p_modelo, '')),
      direccion = btrim(coalesce(p_direccion, '')),
      updated_at = v_ahora
  where id = p_pedido_id;

  select count(*) into v_items from public.pedido_items where pedido_id = p_pedido_id;

  return json_build_object('ok', true, 'item_count', v_items, 'updated_at', v_ahora);
end;
$$;

revoke all on function public.actualizar_pedido(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.actualizar_pedido(uuid, text, text, text, text, text, jsonb) to authenticated;

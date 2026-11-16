-- Cada usuario (administradores incluidos) lee SOLO sus pedidos y sus listas de repuestos.
-- Los registros de otros usuarios no se ven, y tampoco los que quedaran sin dueño válido.
-- Se reemplazan todas las políticas SELECT permisivas de estas tablas (los nombres
-- varían según el historial de migraciones) por una sola de "dueño".
-- Las políticas restrictivas (p. ej. solo_cuentas_activas) no se tocan.
-- Para devolver la visibilidad de administrador sobre todo, añadir `or public.is_admin()`.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename in ('pedidos', 'pedido_items', 'spare_part_lists', 'spare_part_list_items')
      and permissive = 'PERMISSIVE'
      and cmd in ('SELECT', 'ALL')
  loop
    if r.cmd = 'ALL' then
      raise notice 'Política ALL "%" en % no se elimina: revísala a mano (también concede SELECT)', r.policyname, r.tablename;
    else
      execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    end if;
  end loop;
end $$;

create policy "Pedidos: solo el dueño lee"
  on public.pedidos for select to authenticated
  using (user_id = auth.uid());

create policy "Items de pedido: solo el dueño del pedido lee"
  on public.pedido_items for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and p.user_id = auth.uid()));

create policy "Listas: solo el dueño lee"
  on public.spare_part_lists for select to authenticated
  using (user_id = auth.uid());

create policy "Items de lista: solo el dueño de la lista lee"
  on public.spare_part_list_items for select to authenticated
  using (exists (select 1 from public.spare_part_lists l where l.id = list_id and l.user_id = auth.uid()));

-- Verificación sugerida (debe listar solo las 4 políticas SELECT de arriba + restrictivas):
--   select tablename, policyname, permissive, cmd from pg_policies
--   where tablename in ('pedidos','pedido_items','spare_part_lists','spare_part_list_items')
--   order by 1, 2;

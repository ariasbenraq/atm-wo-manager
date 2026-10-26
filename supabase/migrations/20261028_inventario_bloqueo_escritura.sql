-- +--------------------------------------------------+
-- |   Inventario confiable — Migración B             |
-- +--------------------------------------------------+
-- Aplicar DESPUÉS de publicar la app que usa las funciones de
-- 20261027_inventario_rpc.sql. Quita la escritura directa sobre el almacén:
-- desde aquí el stock y el historial solo cambian a través de esas funciones
-- (security definer), y el historial queda de solo agregar registros.
--
-- No incluye conciliación: v_stock_diferencias dio 0 filas al aplicar la
-- migración A (2026-10-26).

drop policy if exists "users manage own warehouse items" on public.warehouse_items;
drop policy if exists "users manage own warehouse transactions" on public.warehouse_transactions;

drop policy if exists "Usuarios ven su inventario" on public.warehouse_items;
create policy "Usuarios ven su inventario"
  on public.warehouse_items for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios ven su historial de inventario" on public.warehouse_transactions;
create policy "Usuarios ven su historial de inventario"
  on public.warehouse_transactions for select
  using (auth.uid() = user_id);

-- Sin políticas de insert/update/delete: RLS rechaza cualquier escritura
-- directa. Las políticas "Admin ve ..." de la migración A se mantienen.

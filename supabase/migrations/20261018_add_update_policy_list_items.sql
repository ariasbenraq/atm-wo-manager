-- Faltaba la política UPDATE para spare_part_list_items.
-- Sin ella, los .update() del cliente (cantidad, editar item)
-- afectan 0 filas silenciosamente bajo RLS.

drop policy if exists "Items editables por dueno o admin" on public.spare_part_list_items;

create policy "Items editables por dueno o admin"
  on public.spare_part_list_items for update
  using (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and (user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and (user_id = auth.uid() or public.is_admin())
    )
  );

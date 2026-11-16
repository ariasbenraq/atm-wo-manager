-- Detalle personal de cada repuesto: texto libre que cada usuario escribe solo para sí
-- (características, notas propias). Los datos del repuesto siguen siendo solo del administrador.

create table if not exists public.repuestos_detalle_personal (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  repuesto_id uuid not null references public.repuestos(id) on delete cascade,
  texto text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, repuesto_id)
);

alter table public.repuestos_detalle_personal enable row level security;

drop policy if exists "Detalle personal: lee el propio" on public.repuestos_detalle_personal;
create policy "Detalle personal: lee el propio"
  on public.repuestos_detalle_personal for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Detalle personal: crea el propio" on public.repuestos_detalle_personal;
create policy "Detalle personal: crea el propio"
  on public.repuestos_detalle_personal for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Detalle personal: edita el propio" on public.repuestos_detalle_personal;
create policy "Detalle personal: edita el propio"
  on public.repuestos_detalle_personal for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Detalle personal: borra el propio" on public.repuestos_detalle_personal;
create policy "Detalle personal: borra el propio"
  on public.repuestos_detalle_personal for delete to authenticated
  using (user_id = auth.uid());

-- Las cuentas pendientes o suspendidas no leen ni escriben (igual que el resto de tablas)
drop policy if exists "solo_cuentas_activas" on public.repuestos_detalle_personal;
create policy "solo_cuentas_activas" on public.repuestos_detalle_personal
  as restrictive for all to authenticated
  using (public.usuario_activo()) with check (public.usuario_activo());

-- Las work orders son de solo lectura para los técnicos: solo los administradores
-- pueden importar (Excel), crear, modificar o eliminar. Como el administrador importa
-- los WOs de todos los legajos (user_id = el administrador), los técnicos deben seguir
-- viendo las filas de SU legajo además de las que ya tenían a su nombre.

create or replace function public.mi_legajo_normalizado()
returns text
language sql stable security definer set search_path = public
as $$
  select upper(regexp_replace(coalesce(legajo, ''), '\s', '', 'g'))
  from public.profiles where id = auth.uid();
$$;

revoke all on function public.mi_legajo_normalizado() from public, anon;
grant execute on function public.mi_legajo_normalizado() to authenticated;

drop policy if exists "Usuarios ven sus workorders, admin ve todas" on public.workorders;
drop policy if exists "Workorders: lectura propia, por legajo o admin" on public.workorders;
create policy "Workorders: lectura propia, por legajo o admin"
  on public.workorders for select
  using (
    public.is_admin()
    or auth.uid() = user_id
    or (
      coalesce(public.mi_legajo_normalizado(), '') <> ''
      and upper(regexp_replace(legajo, '\s', '', 'g')) = public.mi_legajo_normalizado()
    )
  );

drop policy if exists "Usuarios crean sus workorders, admin crea cualquiera" on public.workorders;
drop policy if exists "Usuarios editan sus workorders, admin edita cualquiera" on public.workorders;
drop policy if exists "Usuarios eliminan sus workorders, admin elimina cualquiera" on public.workorders;
drop policy if exists "Workorders: solo admin crea" on public.workorders;
drop policy if exists "Workorders: solo admin edita" on public.workorders;
drop policy if exists "Workorders: solo admin elimina" on public.workorders;

create policy "Workorders: solo admin crea"
  on public.workorders for insert
  with check (public.is_admin());

create policy "Workorders: solo admin edita"
  on public.workorders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Workorders: solo admin elimina"
  on public.workorders for delete
  using (public.is_admin());

-- Verificación sugerida (como técnico, debe devolver 0 filas / error de RLS):
--   insert into public.workorders (user_id, wo, fecha) values (auth.uid(), 'TEST', '01/01/2026');

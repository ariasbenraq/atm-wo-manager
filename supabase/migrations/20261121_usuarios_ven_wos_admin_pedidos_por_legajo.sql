-- 1. Los usuarios ven las work orders subidas por un administrador (solo lectura),
--    además de las suyas y las de su legajo.
-- 2. Un usuario (no admin) solo puede crear pedidos con una WO de su propio legajo.

create or replace function public.wo_subida_por_admin(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'admin');
$$;

revoke all on function public.wo_subida_por_admin(uuid) from public, anon;
grant execute on function public.wo_subida_por_admin(uuid) to authenticated;

drop policy if exists "Workorders: lectura propia, por legajo o admin" on public.workorders;
drop policy if exists "Workorders: lectura propia, subidas por admin o admin" on public.workorders;
create policy "Workorders: lectura propia, subidas por admin o admin"
  on public.workorders for select
  using (
    public.is_admin()
    or auth.uid() = user_id
    or public.wo_subida_por_admin(user_id)
    or (
      coalesce(public.mi_legajo_normalizado(), '') <> ''
      and upper(regexp_replace(legajo, '\s', '', 'g')) = public.mi_legajo_normalizado()
    )
  );

-- Pedidos: la WO debe existir y pertenecer al legajo del usuario. Se valida al crear
-- y cuando cambia la WO; los administradores y el service role no tienen restricción.
create or replace function public._exigir_wo_de_mi_legajo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_legajo text;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.wo is not distinct from old.wo then
    return new;
  end if;

  v_legajo := public.mi_legajo_normalizado();
  if btrim(coalesce(new.wo, '')) = ''
     or coalesce(v_legajo, '') = ''
     or not exists (
       select 1 from public.workorders w
       where btrim(w.wo) = btrim(new.wo)
         and upper(regexp_replace(w.legajo, '\s', '', 'g')) = v_legajo
     ) then
    raise exception 'PEDIDO_WO_AJENA';
  end if;
  return new;
end;
$$;

drop trigger if exists exigir_wo_de_mi_legajo on public.pedidos;
create trigger exigir_wo_de_mi_legajo
  before insert or update of wo on public.pedidos
  for each row execute function public._exigir_wo_de_mi_legajo();

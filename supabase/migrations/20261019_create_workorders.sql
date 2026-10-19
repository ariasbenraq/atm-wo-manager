-- +-----------------------------+
-- |   Wo's (Work Orders /       |
-- |   llamadas de servicio)     |
-- +-----------------------------+

-- El catálogo de WO de pedidos ahora se alimenta de esta tabla;
-- pedidos_wos queda obsoleto.
drop table if exists public.pedidos_wos;

create table if not exists public.workorders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anio text not null default '',
  mes text not null default '',
  cliente text not null default '',
  serie text not null default '',
  modelo text not null default '',
  tipo_pm text not null default '',
  codigo_equipo text not null default '',
  nombre_equipo text not null default '',
  site text not null default '',
  direccion text not null default '',
  distrito text not null default '',
  provincia text not null default '',
  departamento text not null default '',
  lp text not null default '',
  funcion_atm text not null default '',
  horario_pv text not null default '',
  restricciones text not null default '',
  responsable_boveda text not null default '',
  wo text not null default '',
  fecha text not null default '',
  hora text not null default '',
  hora_pv text not null default '',
  legajo text not null default '',
  ce text not null default '',
  dni text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Duplicado = misma WO en misma fecha (una WO puede reprogramarse a otra fecha).
-- Índice no parcial para poder hacer upsert con ON CONFLICT (user_id, wo, fecha);
-- la app nunca inserta filas sin WO.
create unique index if not exists workorders_user_wo_fecha_key
  on public.workorders (user_id, wo, fecha);

alter table public.workorders enable row level security;

create policy "Usuarios ven sus workorders, admin ve todas"
  on public.workorders for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios crean sus workorders, admin crea cualquiera"
  on public.workorders for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Usuarios editan sus workorders, admin edita cualquiera"
  on public.workorders for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios eliminan sus workorders, admin elimina cualquiera"
  on public.workorders for delete
  using (auth.uid() = user_id or public.is_admin());

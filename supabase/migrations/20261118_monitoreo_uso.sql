-- Monitoreo de uso (solo lectura para administradores).
-- La app registra eventos ligeros: vistas de página, permanencia, clics en botones,
-- errores de JavaScript y llamadas a la API fallidas o lentas. Cada usuario solo puede
-- insertar los suyos; solo el administrador los lee, vía la función monitoreo_resumen().

create table if not exists public.eventos_uso (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  sesion_id text,
  tipo text not null check (tipo in ('vista', 'permanencia', 'accion', 'error', 'api')),
  nombre text not null,
  ruta text,
  detalle jsonb,
  duracion_ms integer,
  dispositivo text check (dispositivo is null or dispositivo in ('movil', 'escritorio')),
  created_at timestamptz not null default now()
);

create index if not exists eventos_uso_created_idx on public.eventos_uso (created_at desc);
create index if not exists eventos_uso_tipo_idx on public.eventos_uso (tipo, created_at desc);
create index if not exists eventos_uso_user_idx on public.eventos_uso (user_id, created_at desc);

alter table public.eventos_uso enable row level security;

drop policy if exists "Eventos: el usuario inserta los suyos" on public.eventos_uso;
create policy "Eventos: el usuario inserta los suyos"
  on public.eventos_uso for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Eventos: solo admin lee" on public.eventos_uso;
create policy "Eventos: solo admin lee"
  on public.eventos_uso for select to authenticated
  using (public.is_admin());

drop policy if exists "Eventos: solo admin borra" on public.eventos_uso;
create policy "Eventos: solo admin borra"
  on public.eventos_uso for delete to authenticated
  using (public.is_admin());

-- Resumen agregado para la página /admin/monitoreo -----------------------------

create or replace function public.monitoreo_resumen(p_dias integer default 7)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 7), 365)));
  v_tz constant text := 'America/Lima';
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN';
  end if;

  select jsonb_build_object(
    'desde', v_desde,
    'totales', (
      select jsonb_build_object(
        'eventos', count(*),
        'usuarios', count(distinct user_id),
        'sesiones', count(distinct sesion_id),
        'vistas', count(*) filter (where tipo = 'vista'),
        'acciones', count(*) filter (where tipo = 'accion'),
        'errores', count(*) filter (where tipo = 'error'),
        'api_fallos', count(*) filter (where tipo = 'api' and (coalesce((detalle ->> 'status')::int, 0) >= 400 or detalle ->> 'status' is null)),
        'api_lentas', count(*) filter (where tipo = 'api' and duracion_ms >= 2000),
        'movil', count(distinct sesion_id) filter (where dispositivo = 'movil'),
        'escritorio', count(distinct sesion_id) filter (where dispositivo = 'escritorio')
      ) from eventos_uso where created_at >= v_desde
    ),
    'por_dia', coalesce((
      select jsonb_agg(x order by x.dia) from (
        select to_char((created_at at time zone v_tz)::date, 'YYYY-MM-DD') as dia,
               count(*) filter (where tipo = 'vista') as vistas,
               count(distinct user_id) as usuarios,
               count(*) filter (where tipo = 'error') as errores
        from eventos_uso where created_at >= v_desde
        group by 1
      ) x
    ), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(x order by x.hora) from (
        select extract(hour from created_at at time zone v_tz)::int as hora,
               count(*) filter (where tipo in ('vista', 'accion')) as interacciones,
               count(distinct user_id) as usuarios
        from eventos_uso where created_at >= v_desde
        group by 1
      ) x
    ), '[]'::jsonb),
    'paginas', coalesce((
      select jsonb_agg(x order by x.vistas desc) from (
        select v.nombre,
               count(*) as vistas,
               count(distinct v.user_id) as usuarios,
               (select round(avg(p.duracion_ms))::int from eventos_uso p
                 where p.tipo = 'permanencia' and p.nombre = v.nombre and p.created_at >= v_desde) as permanencia_ms,
               (select count(*) from eventos_uso e
                 where e.tipo = 'error' and e.ruta = v.nombre and e.created_at >= v_desde) as errores
        from eventos_uso v
        where v.tipo = 'vista' and v.created_at >= v_desde
        group by v.nombre
        limit 30
      ) x
    ), '[]'::jsonb),
    'acciones', coalesce((
      select jsonb_agg(x order by x.total desc) from (
        select nombre, ruta, count(*) as total, count(distinct user_id) as usuarios
        from eventos_uso where tipo = 'accion' and created_at >= v_desde
        group by nombre, ruta
        order by count(*) desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'errores', coalesce((
      select jsonb_agg(x order by x.total desc) from (
        select nombre, ruta, count(*) as total, count(distinct user_id) as usuarios, max(created_at) as ultimo
        from eventos_uso where tipo = 'error' and created_at >= v_desde
        group by nombre, ruta
        order by count(*) desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'api', coalesce((
      select jsonb_agg(x order by x.fallos desc, x.lentas desc) from (
        select nombre,
               count(*) as total,
               count(*) filter (where coalesce((detalle ->> 'status')::int, 0) >= 400 or detalle ->> 'status' is null) as fallos,
               count(*) filter (where duracion_ms >= 2000) as lentas,
               round(percentile_cont(0.95) within group (order by duracion_ms))::int as p95_ms
        from eventos_uso where tipo = 'api' and created_at >= v_desde
        group by nombre
        order by count(*) desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'usuarios', coalesce((
      select jsonb_agg(x order by x.eventos desc) from (
        select e.user_id,
               coalesce(nullif(p.full_name, ''), p.email, 'Sin nombre') as nombre,
               p.contrata,
               count(*) filter (where e.tipo = 'vista') as vistas,
               count(*) filter (where e.tipo = 'accion') as acciones,
               count(*) filter (where e.tipo = 'error') as errores,
               count(*) as eventos,
               max(e.created_at) as ultimo
        from eventos_uso e
        left join profiles p on p.id = e.user_id
        where e.created_at >= v_desde
        group by e.user_id, p.full_name, p.email, p.contrata
        order by count(*) desc
        limit 15
      ) x
    ), '[]'::jsonb)
  ) into r;

  return r;
end;
$$;

revoke all on function public.monitoreo_resumen(integer) from public, anon;
grant execute on function public.monitoreo_resumen(integer) to authenticated;

-- Retención: borra eventos más antiguos que p_dias (por defecto 90). Solo admin.
create or replace function public.purgar_eventos_uso(p_dias integer default 90)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  delete from public.eventos_uso where created_at < now() - make_interval(days => greatest(1, coalesce(p_dias, 90)));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purgar_eventos_uso(integer) from public, anon;
grant execute on function public.purgar_eventos_uso(integer) to authenticated;

alter table public.mis_tareas
  add column if not exists ds text,
  add column if not exists arribo text,
  add column if not exists inicio text,
  add column if not exists fin text,
  add column if not exists retorno text,
  add column if not exists tiempos_updated_at timestamptz;

create index if not exists mis_tareas_tiempos_updated_at_idx
  on public.mis_tareas (tiempos_updated_at desc);

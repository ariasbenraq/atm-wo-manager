-- Preferencias de interfaz por usuario (p. ej. colores de las tarjetas de WO por Lima / Regiones).
-- Cada usuario solo lee y escribe las suyas; así siguen al usuario entre dispositivos.

create table if not exists public.preferencias_usuario (
  user_id uuid not null references auth.users(id) on delete cascade,
  clave text not null,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.preferencias_usuario enable row level security;

create policy "Preferencias: el usuario lee las suyas"
  on public.preferencias_usuario for select
  using (auth.uid() = user_id);

create policy "Preferencias: el usuario crea las suyas"
  on public.preferencias_usuario for insert
  with check (auth.uid() = user_id);

create policy "Preferencias: el usuario edita las suyas"
  on public.preferencias_usuario for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Preferencias: el usuario borra las suyas"
  on public.preferencias_usuario for delete
  using (auth.uid() = user_id);

alter table public.pedidos
  add column if not exists modelo text not null default '';

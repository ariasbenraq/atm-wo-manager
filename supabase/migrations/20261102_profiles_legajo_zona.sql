-- Fase 1 multi-técnico: cada usuario tiene nombre (full_name, ya existente),
-- legajo y zona. El administrador los asigna desde /admin/usuarios.

alter table public.profiles
  add column if not exists legajo text not null default '';

alter table public.profiles
  add column if not exists zona text not null default 'LIMA';

-- Un legajo identifica a un único técnico (se ignoran los vacíos)
create unique index if not exists profiles_legajo_unico
  on public.profiles (upper(legajo))
  where legajo <> '';

-- Después de aplicar esta migración, asigna tu legajo desde la pantalla
-- de Usuarios (admin) o con, por ejemplo:
--   update public.profiles set legajo = 'PE101L84' where email = '<tu correo>';

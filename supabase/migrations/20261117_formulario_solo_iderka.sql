-- Solo los técnicos de la contrata IDERKA pueden enviar listas al Google Form.
-- La UI ya oculta la función; este trigger lo hace cumplir en el servidor:
-- bloquea marcar una lista como enviada (form_enviado_en no nulo) cuando el
-- dueño de la lista no es IDERKA. Quitar la marca (volver a null) sigue
-- permitido. Sin usuario (service role / SQL editor) no bloquea.

create or replace function public._exigir_contrata_formulario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or new.form_enviado_en is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.form_enviado_en is not distinct from old.form_enviado_en then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and upper(coalesce(contrata, '')) = 'IDERKA'
  ) then
    raise exception 'FORMULARIO_SOLO_IDERKA';
  end if;
  return new;
end;
$$;

drop trigger if exists exigir_contrata_formulario on public.spare_part_lists;
create trigger exigir_contrata_formulario
  before insert or update of form_enviado_en on public.spare_part_lists
  for each row execute function public._exigir_contrata_formulario();

-- Verificación sugerida (como usuario FONTA, debe fallar con FORMULARIO_SOLO_IDERKA):
--   update public.spare_part_lists set form_enviado_en = now() where id = '<lista>';

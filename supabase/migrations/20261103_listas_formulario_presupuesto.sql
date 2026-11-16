-- Fase 5: estado «enviada al formulario» (independiente de la sincronización con almacén)
-- y N° de presupuesto por repuesto (campo opcional del Google Form de consumo).

alter table public.spare_part_lists
  add column if not exists form_enviado_en timestamptz;

alter table public.spare_part_list_items
  add column if not exists presupuesto text not null default '';

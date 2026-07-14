alter table public.spare_part_lists
  add column site text not null default '',
  add column work_order text not null default '';

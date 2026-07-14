alter table public.spare_part_lists
  add column inventory_synced boolean not null default false,
  add column inventory_synced_at timestamptz;

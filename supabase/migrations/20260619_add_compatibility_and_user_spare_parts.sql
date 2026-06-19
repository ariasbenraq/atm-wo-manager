alter table public.repuestos
  add column if not exists compatibility text,
  alter column tiene_stock set default false;

drop table if exists public.user_spare_parts;

create table if not exists public.spare_part_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.spare_part_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.spare_part_lists(id) on delete cascade,
  spare_part_id uuid not null references public.repuestos(id) on delete cascade,
  created_at timestamptz default now(),
  unique(list_id, spare_part_id)
);

alter table public.spare_part_lists enable row level security;

create policy "Users can view their own spare part lists"
  on public.spare_part_lists for select
  using (auth.uid() = user_id);

create policy "Users can insert their own spare part lists"
  on public.spare_part_lists for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own spare part lists"
  on public.spare_part_lists for update
  using (auth.uid() = user_id);

create policy "Users can delete their own spare part lists"
  on public.spare_part_lists for delete
  using (auth.uid() = user_id);

alter table public.spare_part_list_items enable row level security;

create policy "Users can view items in their lists"
  on public.spare_part_list_items for select
  using (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and user_id = auth.uid()
    )
  );

create policy "Users can insert items in their lists"
  on public.spare_part_list_items for insert
  with check (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and user_id = auth.uid()
    )
  );

create policy "Users can delete items from their lists"
  on public.spare_part_list_items for delete
  using (
    exists (
      select 1 from public.spare_part_lists
      where id = list_id and user_id = auth.uid()
    )
  );

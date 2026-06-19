alter table public.repuestos
  add column if not exists compatibility text,
  alter column tiene_stock set default false;

create table if not exists public.user_spare_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spare_part_id uuid not null references public.repuestos(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, spare_part_id)
);

alter table public.user_spare_parts enable row level security;

create policy "Users can view their own spare parts"
  on public.user_spare_parts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own spare parts"
  on public.user_spare_parts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own spare parts"
  on public.user_spare_parts for delete
  using (auth.uid() = user_id);

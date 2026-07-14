create table if not exists public.warehouse_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  part_number text not null,
  quantity integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, part_number)
);

alter table public.warehouse_items enable row level security;

create policy "users manage own warehouse items"
  on public.warehouse_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.warehouse_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  part_number text not null,
  quantity integer not null,
  type text not null check (type in ('IN', 'OUT', 'ADJUSTMENT')),
  source_type text not null default 'WAREHOUSE' check (source_type in ('WAREHOUSE', 'LIST')),
  source_id uuid,
  site text not null default '',
  work_order text not null default '',
  created_at timestamptz default now()
);

alter table public.warehouse_transactions enable row level security;

create policy "users manage own warehouse transactions"
  on public.warehouse_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

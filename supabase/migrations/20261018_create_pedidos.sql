-- +-----------------------------+
-- |         Pedidos             |
-- +-----------------------------+

-- 1. Catálogo de WO por usuario (WO, ID ATM, Site, Dirección)
create table if not exists public.pedidos_wos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wo text not null,
  id_atm text not null default '',
  site text not null default '',
  direccion text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, wo)
);

alter table public.pedidos_wos enable row level security;

create policy "Usuarios ven sus WOs, admin ve todos"
  on public.pedidos_wos for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios crean sus WOs, admin crea cualquiera"
  on public.pedidos_wos for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Usuarios editan sus WOs, admin edita cualquiera"
  on public.pedidos_wos for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios eliminan sus WOs, admin elimina cualquiera"
  on public.pedidos_wos for delete
  using (auth.uid() = user_id or public.is_admin());

-- 2. Personas que recepcionan (llamada/pedido) y entregan (motorizado)
--    Catálogo global: todos pueden leerlo, solo admin lo gestiona.
create table if not exists public.pedidos_personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('recepcion', 'entrega')),
  created_at timestamptz default now()
);

alter table public.pedidos_personas enable row level security;

create policy "Usuarios leen personas de pedidos"
  on public.pedidos_personas for select
  using (auth.uid() is not null);

create policy "Solo admin crea personas de pedidos"
  on public.pedidos_personas for insert
  with check (public.is_admin());

create policy "Solo admin edita personas de pedidos"
  on public.pedidos_personas for update
  using (public.is_admin());

create policy "Solo admin elimina personas de pedidos"
  on public.pedidos_personas for delete
  using (public.is_admin());

-- 3. Pedidos
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  estado text not null default 'guardado' check (estado in ('guardado', 'recepcionado')),
  wo text not null default '',
  id_atm text not null default '',
  site text not null default '',
  direccion text not null default '',
  recepcionado_por_id uuid references public.pedidos_personas(id) on delete set null,
  recepcionado_por_nombre text not null default '',
  entregado_por_id uuid references public.pedidos_personas(id) on delete set null,
  entregado_por_nombre text not null default '',
  recepcionado_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pedidos enable row level security;

create policy "Usuarios ven sus pedidos, admin ve todos"
  on public.pedidos for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios crean sus pedidos, admin crea cualquiera"
  on public.pedidos for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Usuarios editan sus pedidos, admin edita cualquiera"
  on public.pedidos for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Usuarios eliminan sus pedidos, admin elimina cualquiera"
  on public.pedidos for delete
  using (auth.uid() = user_id or public.is_admin());

-- 4. Items del pedido
create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  spare_part_id uuid not null references public.repuestos(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz default now(),
  unique(pedido_id, spare_part_id)
);

alter table public.pedido_items enable row level security;

create policy "Items de pedidos visibles para dueno o admin"
  on public.pedido_items for select
  using (
    exists (
      select 1 from public.pedidos
      where id = pedido_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Items de pedidos insertables por dueno o admin"
  on public.pedido_items for insert
  with check (
    exists (
      select 1 from public.pedidos
      where id = pedido_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Items de pedidos editables por dueno o admin"
  on public.pedido_items for update
  using (
    exists (
      select 1 from public.pedidos
      where id = pedido_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Items de pedidos eliminables por dueno o admin"
  on public.pedido_items for delete
  using (
    exists (
      select 1 from public.pedidos
      where id = pedido_id and (user_id = auth.uid() or public.is_admin())
    )
  );

-- 5. Permitir source_type 'ORDER' en transacciones de almacén
--    (recepción de pedido → IN trazable al pedido)
alter table public.warehouse_transactions
  drop constraint if exists warehouse_transactions_source_type_check;

alter table public.warehouse_transactions
  add constraint warehouse_transactions_source_type_check
  check (source_type in ('WAREHOUSE', 'LIST', 'ORDER'));

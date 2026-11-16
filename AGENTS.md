# AGENTS.md — atm-wo-manager

React 19 + Vite 7 SPA for managing ATM work orders. Spanish UI. Offline-first with IndexedDB (Dexie), synced to Supabase.

## Quick start

```sh
npm run dev          # http://0.0.0.0:5173 (self-signed HTTPS via basicSsl)
npm run dev:network  # explicit alias
npm run build
npm run lint         # ESLint (entire project)
```

## Dev commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint on `.` |
| `npm run preview` | Preview production build (port 4173) |

No test framework or CI lint/typecheck configured. No TypeScript (plain JSX). GitHub Actions workflow (`.github/workflows/build-and-push.yml`) builds a Docker image on push to `produccion` and pushes to GHCR for Portainer deploys.

## Architecture

**Entrypoint:** `src/main.jsx` — mounts React with `<HeroUIProvider>` + MUI `<LocalizationProvider>` (locale `es`).

**App structure:** routes via react-router-dom v7:
- `/inicio` — home summary (default route)
- `/wos` — work orders (calls): Excel import (multi-sheet) + manual WO + paginated searchable list
- `/repuestos` — spare parts CRUD + add to lists
- `/mis-listas` — spare part lists lifecycle + warehouse inventory sync
- `/pedidos` — parts orders (WO from Wo's page + manual, reception → warehouse IN + "Uso de repuestos" list)
- `/almacen` — per-user warehouse inventory + transactions
- `/admin/usuarios` — admin-only: approve or reject registrations, edit data, reset password, suspend/reactivate, delete account, change role
- `/login` — email or username login
- `/registro` — public sign-up (nombre, apellido, email, contrata Iderka/Fonta, legajo `PE101L84`/`PE101R12`, password); account starts `pendiente`
- `/restablecer-clave` — public; target of the recovery link an admin generates with «Reiniciar clave»; user creates a new password

`Layout.jsx` wraps authenticated pages (desktop sidebar, mobile bottom nav, top bar). Shared state lives in `AppContext` (Dexie-read on mount, synced via `sync.js`). Auth gates in `Layout.jsx` — unauthenticated users redirect to `/login`. Session expiry keeps the app usable with local data + a re-login modal.

**Data flow:**
- Dexie (IndexedDB) is the primary store — 18 schema versions in `src/lib/db.js`
- `src/lib/sync.js` syncs from Supabase to Dexie on auth, clearing local tables first
- Offline graceful: Supabase errors fall back to cached local data; writes set pending flags for retry on next login
- The Tareas / Mis tareas feature was removed; its Supabase tables (`tareas`, `mis_tareas`, `personal_cmca`, `personal_cmpd`, `motivos_aqr`) and Dexie tables are kept untouched but unused

**Auth:** Supabase email/password via `supabase.auth.signInWithPassword()`. Login accepts email or username (username looked up in `profiles` pre-auth). Roles (`admin`/`user`) live in `profiles`, enforced server-side by RLS (`is_admin()`) and client-side via `usePermissions.js`.

## UI conventions

- **HeroUI** for most UI elements (Navbar, Card, Button, Input, Chip, Modal, Dropdown)
- **MUI** for date/time pickers (`@mui/x-date-pickers`), `Alert`, `Fade`, `useMediaQuery`
- **Tailwind CSS v4** (CSS-first via `src/index.css` + `@tailwindcss/vite` plugin) with custom `src/hero.ts` HeroUI plugin. `darkMode: "class"`
- **Icons:** `lucide-react`
- **Locale:** Spanish everywhere — component names, labels, error messages
- **Theme:** `claro | oscuro | sistema`, toggled from the sidebar / «Más» menu (`src/lib/tema.js`, `src/hooks/useTema.js`, saved in `localStorage.tema`, early script in `index.html` avoids flash). Dark mode = `dark` class on `<html>`. Use HeroUI semantic tokens (`bg-content1`, `bg-background`, `text-default-*`, `text-foreground`) — never `bg-white`/`text-gray-*`. HeroUI colors are HSL channels (`hsl(var(--heroui-background))`). 
- **Type & spacing scale (use these, no arbitrary `text-[Npx]`):** page title `text-xl font-semibold` (via `components/ui/PageHeader`); section title `text-base font-semibold`; body `text-sm`; secondary/labels `text-xs` (never below 12px). Cards: `components/ui/SectionCard` (`p-4`, compact rows `p-3`); empty states: `components/ui/EmptyState`. Vertical rhythm `space-y-4` between sections. Mobile touch targets ≥ 44px for primary actions.
- Konsta was removed — everything is HeroUI; `bg-primary`/`text-primary`/`text-primary-foreground` come from `hero.ts`.
- **Accessibility:** icon-only buttons need `aria-label`; muted text uses `default-400/500` (darkened in `hero.ts` for WCAG AA contrast). Audited with axe-core (wcag2a/aa) on the main pages in light and dark.
- `framer-motion` is a required peer dependency of HeroUI — do not remove

## Key files

| File | Purpose |
|---|---|
| `src/lib/db.js` | Dexie schema (18 versions, 16 tables; `cierres` is legacy/unused, `pedidosWos` is obsolete — WOs come from `workorders`) |
| `src/lib/supabase.js` | Supabase client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |
| `src/lib/sync.js` | On login, refreshes the local WO cache |
| `src/lib/date.js` | Date formatting helpers (DD/MM/YYYY) |
| `src/lib/excel.js` | Shared SheetJS helpers: fecha/hora parsing + header normalizer |
| `src/lib/inventario.js` | Wrappers of the inventory RPCs (`ajustar_stock`, `fijar_stock`, `eliminar_item_almacen`, `recepcionar_pedido`, `actualizar_pedido`, `consumir_lista`, `revertir_consumo_lista`) + Spanish error messages |
| `src/lib/wosTecnicos.js` | Technician names (profiles), WO search filters (date/legajo/text), legajo helpers |
| `src/lib/resumen.js`, `src/lib/kitMantenimiento.js` | Home summary (`/inicio`): WOs/parts/lists; weekly kit forecast (each ATM of models 6623/6627/6628/6612 uses 1 filter `4450773447` + 8 suction cups `0090035910`) compared with `warehouse_items` stock and pending pedidos |
| `src/hooks/useLegajo.js` | Legajo of the logged-in user (`profiles.legajo`, assigned by admin) |
| `src/hooks/usePermissions.js` | Roles/permissions (`useIsAdmin`, `useCan`) |
| `src/context/AppContext.jsx` | Shared state, auth, sync orchestration, CRUD |
| `src/components/Layout.jsx` | Sidebar/bottom nav, top bar, auth gate, theme toggle, re-login modal |
| `src/components/ImportarWosExcel.jsx` | Wo's Excel import: sheet picker, legajo filter, upsert by (user, wo, fecha) |
| `src/pages/MisListasPage.jsx` | Lists CRUD + warehouse sync (confirmation shows stock before → after and blocks if insufficient); two independent states per list: warehouse (`inventory_synced`) and Google Form (`form_enviado_en`) |
| `src/lib/googleForm.js`, `src/components/EnviarFormularioModal.jsx` | Prefilled link to the «Consumo de repuestos» Google Form (field ids, 1–7 parts per submission, zona LIMA, legajo (profile, picked from the form list) and email (registered profile email) prefilled, cliente from the WO, N° presupuesto per item). Google gives no confirmation, so the user marks «Ya lo envié» |
| `src/lib/coloresTarjeta.js`, `src/lib/preferencias.js`, `src/hooks/useColoresLegajo.js`, `src/components/PaletaColores.jsx` | Per-user card background colors for Lima (`PE101L…`) vs Regiones (`PE…R…`) WOs; palette keys (light/dark classes, AA-checked) stored in `preferencias_usuario` (RLS: own rows) with a localStorage copy for offline. WO technician name = `workorders.ce` (the CE is the technician's name from the Excel), falling back to the profile with that legajo |
| `src/pages/WosPage.jsx` | Work orders list (10/20 per page, combo search WO/id/distrito/serie) + manual WO |
| `src/pages/PedidosPage.jsx` | Orders: 3-step create wizard (WO → parts, with «Agregar kit» for kit models → confirm; full screen on phones), receive (inventory IN + usage list), admin personas tab; pedidos in `guardado` can be edited (same wizard in edit mode → RPC `actualizar_pedido`, atomic, rejects if already received); `recepcionado` pedidos are read-only |
| `src/pages/AlmacenPage.jsx` | Warehouse inventory + transactions: sticky search, stock filters (con stock / bajo ≤2 / sin stock / todos), tap a card for per-part history |
| `src/pages/RepuestosPage.jsx` | Spare parts CRUD |
| `src/lib/registro.js`, `src/lib/adminUsuarios.js`, `src/components/CuentaBloqueada.jsx` | Sign-up validators (legajo regex, contratas), wrapper of the Edge Function `supabase/functions/admin-usuarios` (`cambiar_estado`, `reiniciar_clave`, `cambiar_email`, `eliminar_usuario` — requires typing «Eliminar cuenta», cascades to all user data; service role, admin-only; deploy with `supabase functions deploy admin-usuarios`, not part of the Docker pipeline), blocked-account screen. `profiles.estado` = `pendiente`/`activo`/`suspendido`; non-active accounts are blocked server-side by restrictive RLS policies (`usuario_activo()`) + a trigger on warehouse tables, and suspended ones are also banned in Auth. Requires Auth → «Confirm email» OFF and `/restablecer-clave` in the Redirect URLs |
| `supabase/migrations/` | SQL migrations (base tables predate this folder) |

## Constraints

- **No TypeScript** — use `.jsx` only
- **No testing infrastructure** — adding one requires setup from scratch
- **`.env` is tracked in git** — contains live Supabase dev keys (public anon key)
- **Supabase tables in use:** `repuestos`, `profiles`, `spare_part_lists`, `spare_part_list_items`, `warehouse_items`, `warehouse_transactions`, `pedidos`, `pedido_items`, `pedidos_personas`, `workorders`, `preferencias_usuario`
- **RLS:** `repuestos` write is admin-only; lists/items/pedidos/workorders are owner-or-admin; warehouse tables are read-only for clients (owner, or admin for reports); `pedidos_personas` is read-for-authenticated/write-admin-only; `profiles` is world-readable (pre-auth username lookup — username enumeration is a known tradeoff)
- **Wo's Excel import** (`ImportarWosExcel`): headers matched after accent/space normalization; only rows matching the user's own `profiles.legajo` are stored (admins can switch to import all legajos; users without legajo cannot import) (comparison strips spaces/symbols and uppercases; on zero matches the report lists the legajo values found in the file); in-file duplicate key is **WO + Fecha** (a WO can be reprogrammed to another date); upserts to Supabase on `(user_id, wo, fecha)`. Multi-sheet workbooks: sheet picker with all tabs pre-selected. The Wo's page is the source of truth for WO selection when creating pedidos.
- **Inventory:** never write `warehouse_items` / `warehouse_transactions` from the client — every stock change goes through the RPCs in `supabase/migrations/20261027_inventario_rpc.sql` (atomic, owner-or-admin, row locks). History is append-only: IN/OUT quantities are positive, ADJUSTMENT is signed; `v_stock_diferencias` must stay empty. A list with `inventory_synced` is locked until `revertir_consumo_lista`.
- **Deploy:** push to `produccion` triggers Docker image build → GHCR → Portainer. `.env` values are injected as Docker build args / GH Actions secrets.

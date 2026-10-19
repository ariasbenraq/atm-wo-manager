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
- `/tareas` — import Excel + manual task creation + global task list
- `/mis-tareas` — assigned tasks + timesheet (`?wo=` param auto-selects a task)
- `/wos` — work orders (calls): Excel import (multi-sheet) + manual WO + paginated searchable list
- `/repuestos` — spare parts CRUD + add to lists
- `/mis-listas` — spare part lists lifecycle + warehouse inventory sync
- `/pedidos` — parts orders (WO from Wo's page + manual, reception → warehouse IN + "Uso de repuestos" list)
- `/almacen` — per-user warehouse inventory + transactions
- `/admin/usuarios` — admin-only profile/role management
- `/login` — email or username login

`Layout.jsx` wraps authenticated pages with inline HeroUI Navbar + next-task alert. Shared state lives in `AppContext` (Dexie-read on mount, synced via `sync.js`). Auth gates in `Layout.jsx` — unauthenticated users redirect to `/login`. Session expiry keeps the app usable with local data + a re-login modal.

**Data flow:**
- Dexie (IndexedDB) is the primary store — 18 schema versions in `src/lib/db.js`
- `src/lib/sync.js` syncs from Supabase to Dexie on auth, clearing local tables first
- `mis_tareas` has custom merge logic (local wins when `tiemposSyncPendiente` is true or local `tiemposUpdatedAt` is newer)
- Offline graceful: Supabase errors fall back to cached local data; writes set pending flags for retry on next login
- Excel import upserts to Supabase on `wo`, then merges into Dexie by `wo` (preserves `localId`)

**Auth:** Supabase email/password via `supabase.auth.signInWithPassword()`. Login accepts email or username (username looked up in `profiles` pre-auth). Roles (`admin`/`user`) live in `profiles`, enforced server-side by RLS (`is_admin()`) and client-side via `usePermissions.js`.

## UI conventions

- **HeroUI** for most UI elements (Navbar, Card, Button, Input, Chip, Modal, Dropdown)
- **MUI** for date/time pickers (`@mui/x-date-pickers`), `Alert`, `Fade`, `useMediaQuery`
- **Tailwind CSS v4** (CSS-first via `src/index.css` + `@tailwindcss/vite` plugin) with custom `src/hero.ts` HeroUI plugin. `darkMode: "class"`
- **Icons:** `lucide-react`
- **Locale:** Spanish everywhere — component names, labels, error messages
- `framer-motion` is a required peer dependency of HeroUI — do not remove

## Key files

| File | Purpose |
|---|---|
| `src/lib/db.js` | Dexie schema (18 versions, 16 tables; `cierres` is legacy/unused, `pedidosWos` is obsolete — WOs come from `workorders`) |
| `src/lib/supabase.js` | Supabase client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |
| `src/lib/sync.js` | Supabase → Dexie sync + merge logic |
| `src/lib/date.js` | Date formatting helpers (DD/MM/YYYY) |
| `src/lib/excel.js` | Shared SheetJS helpers: fecha/hora parsing + header normalizer |
| `src/lib/wosConfig.js` | `LEGAJO_ACTUAL` ('PE101L84') — legajo filter for Wo's ingestion/view |
| `src/hooks/usePermissions.js` | Roles/permissions (`useIsAdmin`, `useCan`) |
| `src/context/AppContext.jsx` | Shared state, auth, sync orchestration, CRUD |
| `src/components/Layout.jsx` | Navbar, auth gate, next-task alert, re-login modal |
| `src/components/ImportarExcel.jsx` | Task Excel (.xlsx) import via SheetJS |
| `src/components/ImportarWosExcel.jsx` | Wo's Excel import: sheet picker, legajo filter, upsert by (user, wo, fecha) |
| `src/components/FormularioCierre.jsx` | Task closure / timesheet form |
| `src/pages/MisListasPage.jsx` | Lists CRUD + warehouse sync |
| `src/pages/WosPage.jsx` | Work orders list (10/20 per page, combo search WO/id/distrito/serie) + manual WO |
| `src/pages/PedidosPage.jsx` | Orders: create (WO from Wo's), receive (inventory IN + usage list), admin personas tab |
| `src/pages/AlmacenPage.jsx` | Warehouse inventory + transactions |
| `src/pages/RepuestosPage.jsx` | Spare parts CRUD |
| `supabase/migrations/` | SQL migrations (base tables predate this folder) |

## Constraints

- **No TypeScript** — use `.jsx` only
- **No testing infrastructure** — adding one requires setup from scratch
- **`.env` is tracked in git** — contains live Supabase dev keys (public anon key)
- **Supabase tables in use:** `tareas`, `mis_tareas`, `repuestos`, `personal_cmca`, `personal_cmpd`, `motivos_aqr`, `profiles`, `spare_part_lists`, `spare_part_list_items`, `warehouse_items`, `warehouse_transactions`, `pedidos`, `pedido_items`, `pedidos_personas`, `workorders`
- **RLS:** `repuestos` write is admin-only; lists/items/warehouse/pedidos/workorders are owner-or-admin; `pedidos_personas` is read-for-authenticated/write-admin-only; `profiles` is world-readable (pre-auth username lookup — username enumeration is a known tradeoff)
- **Excel import** expects columns: `WO`, `MODELO`, `SERIE`, `ID`, `NOMBRE`, `DIRECCION`, `DISTRITO`, `FECHA`, `HORA`, `CE`. Duplicate WO values in the file are rejected without saving anything.
- **Wo's Excel import** (`ImportarWosExcel`): headers matched after accent/space normalization; only rows matching `LEGAJO_ACTUAL` ('PE101L84') are stored (comparison strips spaces/symbols and uppercases; on zero matches the report lists the legajo values found in the file); in-file duplicate key is **WO + Fecha** (a WO can be reprogrammed to another date); upserts to Supabase on `(user_id, wo, fecha)`. Multi-sheet workbooks: sheet picker with all tabs pre-selected. The Wo's page is the source of truth for WO selection when creating pedidos.
- **Deploy:** push to `produccion` triggers Docker image build → GHCR → Portainer. `.env` values are injected as Docker build args / GH Actions secrets.

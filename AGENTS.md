# AGENTS.md — atm-wo-manager

React 19 + Vite 7 SPA for managing ATM work orders. Spanish UI. Offline-first with IndexedDB (Dexie), synced to Supabase.

## Quick start

```sh
npm run dev          # http://0.0.0.0:5173
npm run dev:network  # explicit alias
npm run build
npm run lint         # ESLint (entire project)
```

`predev`/`prebuild` auto-run `npm run styles:build` which generates `src/tailwind.generated.css` via a custom script.

## Dev commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint on `.` |
| `npm run styles:build` | Generate `src/tailwind.generated.css` |

No test framework or CI configured. No typecheck (plain JSX, no TypeScript).

## Architecture

**Entrypoint:** `src/main.jsx` — mounts React with `<HeroUIProvider>` + MUI `<LocalizationProvider>` (locale `es`).

**App structure:** 3 routes via react-router-dom v7 (`/tareas`, `/mis-tareas`, `/repuestos`). `Layout.jsx` wraps authenticated pages with Navbar + next-task alert. Shared state lives in `AppContext` (Dexie-read on mount, synced via `sync.js`). Auth gates in `Layout.jsx` — unauthenticated users redirect to `/login`. `MisTareasPage` reads optional `?wo=` search param to auto-select a task.

**Data flow:**
- Dexie (IndexedDB) is the primary store — 10 schema versions in `src/lib/db.js`
- `src/lib/sync.js` syncs from Supabase to Dexie on auth, clearing local tables first
- `mis_tareas` has custom merge logic (local wins when `tiemposSyncPendiente` is true or local `tiemposUpdatedAt` is newer)
- Offline graceful: Supabase errors fall back to cached local data

**Auth:** Supabase email/password via `supabase.auth.signInWithPassword()`.

## UI conventions

- **HeroUI** for most UI elements (Navbar, Card, Button, Input, Chip, Modal, Dropdown)
- **MUI** for date/time pickers (`@mui/x-date-pickers`), `Alert`, `Fade`, `useMediaQuery`
- **Tailwind CSS v4** with custom `hero.ts` plugin. `darkMode: "class"`
- **Icons:** `lucide-react` + Material Symbols (`edit` icon from Google Fonts CDN)
- **Locale:** Spanish everywhere — component names, labels, error messages

## Key files

| File | Purpose |
|---|---|
| `src/lib/db.js` | Dexie schema (10 versions, 7 tables) |
| `src/lib/supabase.js` | Supabase client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |
| `src/lib/sync.js` | Supabase → Dexie sync + merge logic |
| `src/lib/date.js` | Date formatting helpers (DD/MM/YYYY) |
| `src/components/ImportarExcel.jsx` | Excel (.xlsx) import via SheetJS |
| `src/components/FormularioCierre.jsx` | Task closure / timesheet form |
| `supabase/migrations/` | SQL migrations |

## Constraints

- **No TypeScript** — use `.jsx` only
- **No testing infrastructure** — adding one requires setup from scratch
- **`.env` is tracked in git** — contains live Supabase dev keys (public anon key)
- **Supabase tables in use:** `tareas`, `mis_tareas`, `repuestos`, `personal_cmca`, `personal_cmpd`, `motivos_aqr`
- **Excel import** expects columns: `WO`, `MODELO`, `SERIE`, `ID`, `NOMBRE`, `DIRECCION`, `DISTRITO`, `FECHA`, `HORA`, `CE`. Duplicate WO values in the file are rejected without saving anything.

# ATM WO Manager

SPA para gestionar órdenes de trabajo de cajeros automáticos (ATM). Interfaz en español, pensada para usarse offline y sincronizar con Supabase cuando hay conexión.

## Stack

- **Frontend:** React 19 + Vite 7
- **UI:** HeroUI + MUI (pickers/Alert) + Tailwind CSS v4 + lucide-react
- **Estado local:** Dexie (IndexedDB) como store principal
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Importación:** SheetJS (`.xlsx`)

## Funcionalidades

- Importar tareas desde Excel (WO, modelo, serie, ID ATM, nombre, dirección, distrito, fecha, hora, CE) con upsert por WO
- Wo's (workorders): importación de Excel multi-pestaña (filtro por legajo, dedupe WO+fecha), alta manual, lista paginada con búsqueda combinada
- Crear tareas manualmente y asignarlas a "Mis tareas"
- Hoja de tiempos por tarea (DS, arribo, inicio, fin, retorno) con cálculo automático de retorno
- Repuestos (CRUD, solo admin edita) y listas de repuestos por usuario
- Pedidos de repuestos: WOs desde la página Wo's (o manuales), recepción que alimenta almacén y crea la lista "Uso de repuestos - {WO}"
- Almacén personal por usuario con inventario y movimientos (IN/OUT/ajuste)
- Sincronización de listas contra inventario de almacén
- Roles admin/usuario gestionados por admin
- Login por email o nombre de usuario

## Requisitos

- Node.js 22+
- Un proyecto Supabase con las migraciones de `supabase/migrations/` aplicadas (las tablas base `tareas`, `mis_tareas`, `repuestos`, `personal_cmca`, `personal_cmpd`, `motivos_aqr` anteceden a esa carpeta)

## Configuración

Copia `.env.example` a `.env` y completa tus claves:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY
```

## Desarrollo

```sh
npm install
npm run dev          # https://0.0.0.0:5173 (certificado autofirmado)
npm run build
npm run preview      # puerto 4173
npm run lint
```

## Estructura

```
src/
  components/   # Layout (navbar/auth), importación Excel, formularios, listas
  context/      # AppContext: estado global, auth, orquestación de sync
  hooks/        # usePermissions (roles)
  lib/          # db (Dexie), sync, supabase client, date helpers
  pages/        # Tareas, Mis tareas, Repuestos, Mis listas, Almacén, Admin, Login
supabase/
  migrations/   # Migraciones SQL (RLS, profiles, listas, almacén)
```

## Despliegue

Push a la rama `produccion` dispara el workflow de GitHub Actions: build de imagen Docker → GHCR → despliegue vía Portainer (`docker-compose.yml` usa red externa `edge`).

## Notas

- La app sigue funcionando con datos locales si Supabase no responde; los cambios pendientes se reintentan al volver a iniciar sesión.
- `.env` está trackeado en git con claves anon de desarrollo (son públicas por diseño).

# Remodelación — Work Orders (`WosPage`)

| Campo | Valor |
|---|---|
| **Ruta** | `/WosPage` |
| **Archivo(s)** | `src/pages/WosPage.jsx` + componentes relacionados (tarjeta WO, modal de importación, modal de búsqueda, FAB) |
| **Estado** | Listo para plan |
| **Prioridad** | Alta |
| **Roles afectados** | Todos |

---

## 1. Situación actual

- Importa un Excel con work orders (WO) entregado por FSC.
- Muestra las WO agrupadas por fecha.
- Cada WO se muestra como tarjeta con información resumida.
- Muestra navbar y menú hamburguesa.

## 2. Problemas

| # | Problema | Impacto |
|---|---|---|
| P1 | Dos personas entregan el Excel con columnas de nombre distinto pero igual significado | La información no se carga |
| P2 | Las tarjetas no muestran datos clave | Hay que entrar a cada WO para consultar o copiar datos |
| P3 | No hay iconos de copiado en los datos clave | Copiar para formularios/reportes es lento e impreciso |
| P4 | El campo de importación es muy grande | Relega la lista de WO a segundo plano |

## 3. Objetivo

Ver con facilidad la información de las work orders: lista protagonista, datos clave copiables, filtros rápidos, búsqueda ágil y funcionamiento offline.

## 4. Reglas técnicas transversales

### 4.1 Normalización de columnas del Excel (HU-01)

| Campo interno | Alias aceptados en el Excel (normalizar: minúsculas, sin tildes, trim) |
|---|---|
| `customer_code` | `Customer Code`, `Cliente` |
| `serie` | `SERIE`, `N° de Serie` |
| `atm_id` | `ID (ATM/Kiosko)`, `Código del Equipo` |
| `site` | Ver regla de SITE abajo |

**Regla de SITE** (resolución por prioridad, por fila):
1. Si existe columna `Site` y su valor es distinto de `Agencia` / `Neutro` → usar ese valor.
2. Si no, y existe `Nombre del Equipo` → usarlo como `site`.
3. Si el valor de `Site` es `Agencia` o `Neutro`, **no se importa** como site (descartar).
4. Si ninguna opción da valor → `site` vacío (la WO se importa igual; ver pregunta abierta Q3).

**Merge entre archivos:** si dos archivos traen la misma WO, completar campos vacíos con el valor del otro archivo sin pisar valores válidos (ver Q2).

### 4.2 Búsqueda (HU-04)
- Campos buscables: `work_order`, `id` (ATM), `site`, `distrito`, `legajo`.
- Debounce de ~300 ms mientras se teclea.
- Consulta primero contra caché local (Dexie); resultados recientes cacheados en el navegador.
- Al elegir un resultado en el modal, la página se posiciona/filtra para mostrar esa WO.

### 4.3 Orden de la lista
De hoy y lo más próximo (fecha y hora) hacia el futuro. Las WO se siguen agrupando por fecha.

### 4.4 Offline
La información de WO debe quedar en caché local para trabajar sin internet (lectura, filtros, búsqueda, copiado). La importación requiere conexión salvo que se defina lo contrario (Q4).

### 4.5 Estado de carga
Skeleton en la carga inicial, durante consultas y durante la importación (nunca pantalla en blanco).

## 5. Historias de usuario

### HU-01 — Homogenizar campos de importación
**Como** usuario **quiero** importar WO de Excel de distintas personas sin que fallen por nombres de columna distintos, **para** no perder información ni duplicar registros.
- **Criterios de aceptación**
  - [ ] Se aplica el mapeo de alias y la regla de SITE de la sección 4.1.
  - [ ] Importar el mismo archivo dos veces no genera duplicados.
  - [ ] Columnas no reconocidas se ignoran sin romper la importación.
  - [ ] Se informa al usuario cuántas filas se importaron, actualizaron u omitieron.
- **Prioridad:** Alta
- **Técnico:** revisar primero el esquema actual de Supabase para work orders e importación (tabla, claves únicas, columnas) y definir si hace falta migración.

### HU-02 — Actualizar la previsualización (tarjeta) de la WO
**Como** usuario **quiero** ver los datos clave en la tarjeta **para** no entrar a cada WO.
- **Criterios de aceptación**
  - [ ] La tarjeta muestra: **WO** (con icono copiar), **SITE** (con icono copiar; ubicación asignada por el cliente), **Modelo** (con icono copiar), **Serie** (con icono copiar), **fecha y hora**.
  - [ ] El icono copia solo ese valor al portapapeles y da feedback visual (ej. toast o check).
- **Prioridad:** Alta

### HU-03 — Toggle "Asignados a mí"
**Como** usuario **quiero** filtrar solo las WO asignadas a mi legajo.
- **Criterios de aceptación**
  - [ ] Toggle sobre las tarjetas, con la etiqueta "Asignados a mí".
  - [ ] Encendido: solo WO cuyo legajo coincide con el del usuario.
  - [ ] Combinable con el toggle de HU-06 y con la búsqueda.
- **Prioridad:** Alta

### HU-04 — FAB de búsqueda
**Como** usuario **quiero** un Floating Action Button para buscar WO.
- **Criterios de aceptación**
  - [ ] La opción de búsqueda usa icono de lupa y abre un modal.
  - [ ] Busca por WO, ID, site y legajo (sección 4.2).
  - [ ] Al elegir un resultado, la página muestra esa WO.
- **Prioridad:** Alta

### HU-05 — Skeleton de carga
**Como** usuario **quiero** ver un skeleton mientras carga la página o la consulta.
- **Criterios de aceptación**
  - [ ] Skeleton visible al entrar a la página en lugar de pantalla en blanco.
  - [ ] Mismo estilo reutilizado en importación (HU-07).
- **Prioridad:** Alta

### HU-06 — Toggle "Work orders de hoy"
**Como** usuario **quiero** filtrar solo las WO de hoy.
- **Criterios de aceptación**
  - [ ] Toggle sobre las tarjetas, con la etiqueta "Work orders de hoy".
  - [ ] Encendido: solo WO con fecha de hoy.
  - [ ] Combinable con HU-03 y la búsqueda.
- **Prioridad:** Alta
- *Nota: el texto original de esta HU repetía el criterio de "asignadas a mi legajo"; se corrigió.*

### HU-07 — Botón de importación dentro del FAB
**Como** usuario **quiero** un botón de importar en el FAB, **para** liberar espacio en pantalla.
- **Criterios de aceptación**
  - [ ] Se elimina el campo de importación actual; se reemplaza por esta opción.
  - [ ] Al pulsar, abre un modal para elegir archivo(s) y las pestañas a importar.
  - [ ] Botón de confirmación de importación.
  - [ ] Muestra skeleton mientras importa.
- **Prioridad:** Alta

## 6. Cambios de lógica

| Antes | Después |
|---|---|
| Consulta con filtros | Búsqueda sensible a WO, ID, site y legajo, con debounce, sobre caché local |
| Importación acepta un solo formato de columnas | Importación con mapeo de alias y regla de SITE |

## 7. Cambios de UI

- Eliminar el campo de importación; la importación vive en el FAB.
- Agregar toggles "Asignados a mí" y "Work orders de hoy" sobre las tarjetas.
- FAB con dos acciones: buscar (lupa) e importar.
- Tarjeta rediseñada con iconos de copiado (HU-02).
- Skeleton en carga e importación.
- Orden: de hoy/más próximo hacia el futuro.

## 8. Impacto en datos

- [ ] Cambia esquema Dexie (`src/lib/db.js`, nueva versión) — **probable**: índices para búsqueda y caché offline; confirmar al revisar el esquema.
- [x] Requiere migración Supabase (`supabase/migrations/`)
- [ ] Cambia políticas RLS
- [ ] Cambia lógica de sync (`src/lib/sync.js`) — revisar si el caché offline lo exige.
- [ ] Toca RPCs de inventario
- [x] Afecta importación Excel
- [x] Comportamiento offline distinto (caché local de WO)

## 9. Dependencias con otras páginas

- `PedidosPage`: depende de los datos de WO; verificar que la normalización (`site`, `serie`, `atm_id`) no rompa sus consultas.

## 10. Fuera de alcance

- (Por definir.)

## 11. Riesgos y preguntas abiertas

- [ ] **Q1.** Revisar el estilo del repositorio de referencia https://github.com/Grashjs/cmms/tree/main/mobile para la UI.
- [ ] **Q2.** ¿Cuál es la clave única de una WO para evitar duplicados y hacer merge (número de WO)?
- [ ] **Q3.** ¿Qué hacer con filas sin site resoluble?
- [ ] **Q4.** ¿La importación debe funcionar offline o solo con conexión?
- [ ] **Q5.** ¿De dónde sale el legajo del usuario (perfil/sesión) para el toggle de HU-03?
- [ ] **Q6.** ¿"Hoy" se calcula con la zona horaria local (America/Lima)?

## 12. Plan de trabajo sugerido

| Fase | Contenido | HU | Depende de |
|---|---|---|---|
| 0 | Revisar esquema Supabase/Dexie y resolver Q2, Q3, Q5 | — | — |
| 1 ✅ | Lógica de importación (alias + SITE + dedupe). **No requirió migración**: `customer_code`→`cliente`, `atm_id`→`codigo_equipo`; clave única sigue `(user_id, wo, fecha)` | HU-01 | Fase 0 |
| 2 ✅ | FAB con importación (modal, pestañas, confirmación) y skeleton. FAB = speed-dial (Importar Excel / Nueva WO); `WosSkeleton` compartido | HU-07, HU-05 | Fase 1 |
| 3 ✅ | Nueva tarjeta de WO con iconos de copiado. `WoCard.jsx`: WO, ID (`codigo_equipo`), Site (fallback `nombre_equipo`), Modelo, Serie, fecha y hora; copia con check de 1,5 s y fallback sin Clipboard API | HU-02 | Fase 1 |
| 4 ✅ | Toggles y orden de la lista (legajo = `LEGAJO_ACTUAL` por ahora, Q5 sigue abierta; "hoy" en America/Lima; futuras ascendente, pasadas al final) | HU-03, HU-06 | Fase 3 |
| 5 ✅ | Búsqueda en FAB: `BuscarWoModal.jsx` (debounce 300 ms, consulta Dexie por WO/ID/site/distrito/legajo, 8 recientes en localStorage). Al elegir, la lista filtra a esa WO (chip para quitar) y limpia toggles/fecha. Se retiró el buscador inline y el input de fecha bajo los toggles | HU-04 | Fases 2 y 4 |
| 6 | Caché offline y pruebas finales (con PedidosPage) | — | Todas |

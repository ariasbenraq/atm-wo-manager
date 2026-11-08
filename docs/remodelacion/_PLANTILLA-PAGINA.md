# Remodelación — `<Nombre de la página>`

> Copia este archivo como `docs/remodelacion/<ruta>.md` (ej. `wos.md`, `mis-tareas.md`) y completa solo lo que aplique.
> Borra las secciones que no necesites. Lo importante es que cada cambio quede lo bastante claro para convertirse luego en tareas del plan.

| Campo | Valor |
|---|---|
| **Ruta** | `/ruta` |
| **Archivo(s)** | `src/pages/XxxPage.jsx`, componentes relacionados |
| **Estado** | ☐ Borrador · ☐ Revisado · ☐ Listo para plan |
| **Prioridad** | Alta / Media / Baja |
| **Roles afectados** | admin / user / ambos |

---

## 1. Situación actual
*Cómo funciona hoy, en pocas líneas. Qué datos lee/escribe (tablas Dexie / Supabase).*

-
-

## 2. Problemas / dolores
*Qué no funciona bien, qué confunde, qué es lento o frágil.*

| # | Problema | Impacto |
|---|---|---|
| P1 | | |
| P2 | | |

## 3. Objetivo de la remodelación
*Una o dos frases: qué debe ser cierto cuando termine.*

## 4. Historias de usuario

Formato: **Como** `<rol>` **quiero** `<acción>` **para** `<beneficio>`.

### HU-01 — `<título corto>`
- **Como** … **quiero** … **para** …
- **Criterios de aceptación**
  - [ ] Dado … cuando … entonces …
  - [ ] …
- **Prioridad:** Alta / Media / Baja
- **Notas / dudas:**

### HU-02 — `<título corto>`
- **Como** … **quiero** … **para** …
- **Criterios de aceptación**
  - [ ] …

## 5. Cambios de lógica
*Reglas de negocio nuevas o modificadas (validaciones, estados, flujos, cálculos).*

| Antes | Después |
|---|---|
| | |

## 6. Cambios de UI
*Qué se agrega, mueve o quita. Puedes pegar un boceto o captura.*

-

## 7. Impacto en datos
- [ ] Cambia esquema Dexie (`src/lib/db.js`, nueva versión)
- [ ] Requiere migración Supabase (`supabase/migrations/`)
- [ ] Cambia políticas RLS
- [ ] Cambia lógica de sync (`src/lib/sync.js`)
- [ ] Toca RPCs de inventario (`src/lib/inventario.js`)
- [ ] Afecta importación Excel
- [ ] Comportamiento offline distinto

*Detalle:*

## 8. Dependencias con otras páginas
*Qué otras páginas/flujos se ven afectados (ej. Wo's → Pedidos).*

-

## 9. Fuera de alcance
-

## 10. Riesgos y preguntas abiertas
- [ ] …

## 11. Orden sugerido de trabajo
1.
2.

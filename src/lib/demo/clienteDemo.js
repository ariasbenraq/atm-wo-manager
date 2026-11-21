// Cliente «Supabase» falso para el modo demostración: implementa en memoria justo lo que usa la app
// (from/select/insert/update/upsert/delete/eq/in/order/limit/single/maybeSingle, relaciones embebidas,
// rpc de inventario y auth mínima). No hace ninguna petición de red: nada llega a la base de datos.
// El estado vive en sessionStorage, así que sobrevive a un F5 pero muere al cerrar la pestaña o salir.
import { crearBaseDemo } from './datosDemo'
import {
  DEMO_PERFIL, DEMO_SESION, DEMO_USER_ID, esModoDemo, guardarBase, leerBaseGuardada, salirModoDemo,
} from './modoDemo'

let base = null

function obtenerBase() {
  if (!base) base = leerBaseGuardada() || crearBaseDemo()
  return base
}

const guardar = () => guardarBase(base)
const clonar = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const tabla = nombre => (obtenerBase()[nombre] ??= [])
const ahoraIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

// ── Esquema mínimo: relaciones embebidas, valores por defecto y restricciones únicas ──
const RELACIONES = {
  pedido_items: { repuestos: { tipo: 'uno', tabla: 'repuestos', fk: 'spare_part_id' } },
  spare_part_list_items: { repuestos: { tipo: 'uno', tabla: 'repuestos', fk: 'spare_part_id' } },
  pedidos: { pedido_items: { tipo: 'muchos', tabla: 'pedido_items', fk: 'pedido_id' } },
  spare_part_lists: { spare_part_list_items: { tipo: 'muchos', tabla: 'spare_part_list_items', fk: 'list_id' } },
}

const DEFECTOS = {
  pedidos: {
    estado: 'guardado', wo: '', id_atm: '', site: '', modelo: '', direccion: '',
    recepcionado_por_id: null, recepcionado_por_nombre: '', entregado_por_id: null,
    entregado_por_nombre: '', recepcionado_at: null,
  },
  spare_part_lists: {
    site: '', work_order: '', inventory_synced: false, inventory_synced_at: null, form_enviado_en: null,
  },
  spare_part_list_items: { presupuesto: '', quantity: 1 },
  pedido_items: { quantity: 1 },
}

const UNICOS = {
  pedido_items: ['pedido_id', 'spare_part_id'],
  spare_part_list_items: ['list_id', 'spare_part_id'],
  warehouse_items: ['user_id', 'part_number'],
  repuestos: ['part_number'],
}

const CASCADAS = {
  pedidos: [['pedido_items', 'pedido_id']],
  spare_part_lists: [['spare_part_list_items', 'list_id']],
  repuestos: [['pedido_items', 'spare_part_id'], ['spare_part_list_items', 'spare_part_id']],
}

const error = (message, code) => ({ message, code })
const igual = (a, b) => a === b || (a != null && b != null && String(a) === String(b))

function partirSeleccion(texto) {
  const partes = []
  let profundidad = 0
  let actual = ''
  for (const c of texto) {
    if (c === '(') profundidad++
    if (c === ')') profundidad--
    if (c === ',' && profundidad === 0) { partes.push(actual); actual = '' } else actual += c
  }
  if (actual.trim()) partes.push(actual)
  return partes.map(p => p.trim()).filter(Boolean)
}

function proyectar(nombreTabla, fila, columnas) {
  const salida = {}
  for (const token of partirSeleccion(columnas || '*')) {
    const embebido = token.match(/^(\w+)\(([\s\S]*)\)$/)
    if (token === '*') {
      Object.assign(salida, fila)
    } else if (embebido) {
      const rel = RELACIONES[nombreTabla]?.[embebido[1]]
      if (!rel) { salida[embebido[1]] = null; continue }
      if (rel.tipo === 'uno') {
        const hijo = tabla(rel.tabla).find(f => igual(f.id, fila[rel.fk]))
        salida[embebido[1]] = hijo ? proyectar(rel.tabla, hijo, embebido[2]) : null
      } else {
        salida[embebido[1]] = tabla(rel.tabla)
          .filter(f => igual(f[rel.fk], fila.id))
          .map(f => proyectar(rel.tabla, f, embebido[2]))
      }
    } else {
      salida[token] = fila[token]
    }
  }
  return salida
}

function comparar(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true })
}

class Consulta {
  constructor(nombre) {
    this.nombre = nombre
    this.op = 'select'
    this.columnas = '*'
    this.filtros = []
    this.ordenes = []
    this.limite = null
    this.modo = null
    this.conteo = false
    this.soloConteo = false
    this.devuelve = false
  }

  select(columnas = '*', opciones = {}) {
    if (this.op === 'select') {
      this.columnas = columnas
      this.conteo = Boolean(opciones.count)
      this.soloConteo = Boolean(opciones.head)
    } else {
      this.devuelve = true
      this.columnas = columnas
    }
    return this
  }

  insert(payload) { this.op = 'insert'; this.payload = payload; return this }
  update(payload) { this.op = 'update'; this.payload = payload; return this }
  upsert(payload, opciones = {}) { this.op = 'upsert'; this.payload = payload; this.conflicto = opciones.onConflict; return this }
  delete() { this.op = 'delete'; return this }
  eq(col, val) { this.filtros.push({ col, vals: [val] }); return this }
  in(col, vals) { this.filtros.push({ col, vals }); return this }
  order(col, { ascending = true } = {}) { this.ordenes.push({ col, ascending }); return this }
  limit(n) { this.limite = n; return this }
  single() { this.modo = 'single'; return this }
  maybeSingle() { this.modo = 'maybe'; return this }

  then(ok, ko) { return Promise.resolve().then(() => this.ejecutar()).then(ok, ko) }

  coinciden() {
    return tabla(this.nombre).filter(f => this.filtros.every(({ col, vals }) => vals.some(v => igual(f[col], v))))
  }

  responder(filas, extra = {}) {
    let salida = filas.map(f => proyectar(this.nombre, f, this.columnas))
    salida = clonar(salida)
    if (this.modo === 'single') {
      if (salida.length !== 1) return { data: null, error: error('JSON object requested, multiple (or no) rows returned', 'PGRST116'), ...extra }
      return { data: salida[0], error: null, ...extra }
    }
    if (this.modo === 'maybe') {
      if (salida.length > 1) return { data: null, error: error('Más de una fila', 'PGRST116'), ...extra }
      return { data: salida[0] ?? null, error: null, ...extra }
    }
    return { data: salida, error: null, ...extra }
  }

  ejecutar() {
    try {
      return this.correr()
    } catch (e) {
      return { data: null, error: error(e.message || String(e), e.code) }
    }
  }

  correr() {
    if (this.op === 'select') {
      let filas = this.coinciden()
      const total = filas.length
      for (const { col, ascending } of [...this.ordenes].reverse()) {
        filas = [...filas].sort((a, b) => (ascending ? 1 : -1) * comparar(a[col], b[col]))
      }
      if (this.limite != null) filas = filas.slice(0, this.limite)
      if (this.soloConteo) return { data: null, error: null, count: total }
      return this.responder(filas, this.conteo ? { count: total } : {})
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const entrada = Array.isArray(this.payload) ? this.payload : [this.payload]
      const guardadas = []
      for (const fila of entrada) {
        const claves = this.op === 'upsert' && this.conflicto
          ? this.conflicto.split(',').map(s => s.trim())
          : null
        const existente = claves
          ? tabla(this.nombre).find(f => claves.every(c => igual(f[c], fila[c])))
          : null
        if (existente) {
          Object.assign(existente, clonar(fila))
          guardadas.push(existente)
          continue
        }
        const nueva = { id: uuid(), created_at: ahoraIso(), updated_at: ahoraIso(), ...clonar(DEFECTOS[this.nombre] || {}), ...clonar(fila) }
        const unico = UNICOS[this.nombre]
        if (unico && tabla(this.nombre).some(f => unico.every(c => igual(f[c], nueva[c])))) {
          const e = new Error(`duplicate key value violates unique constraint on ${this.nombre}`)
          e.code = '23505'
          throw e
        }
        tabla(this.nombre).push(nueva)
        guardadas.push(nueva)
      }
      guardar()
      return this.devuelve ? this.responder(guardadas) : { data: null, error: null }
    }

    if (this.op === 'update') {
      const filas = this.coinciden()
      for (const f of filas) Object.assign(f, clonar(this.payload))
      guardar()
      return this.devuelve ? this.responder(filas) : { data: null, error: null }
    }

    // delete
    const filas = this.coinciden()
    const ids = new Set(filas)
    base[this.nombre] = tabla(this.nombre).filter(f => !ids.has(f))
    for (const [hija, fk] of CASCADAS[this.nombre] || []) {
      const borrados = new Set(filas.map(f => f.id))
      base[hija] = tabla(hija).filter(f => !borrados.has(f[fk]))
    }
    guardar()
    return { data: null, error: null }
  }
}

// ── RPC de inventario (mismas reglas y mensajes que supabase/migrations/20261027_inventario_rpc.sql) ──
function falla(codigo) { throw new Error(codigo) }

function moverStock({ pn, delta, tipo, origen, origenId = null, site = '', wo = '', motivo = '' }) {
  if (!delta) falla('CANTIDAD_INVALIDA')
  if ((tipo === 'IN' && delta < 0) || (tipo === 'OUT' && delta > 0)) falla('TIPO_INVALIDO')
  let item = tabla('warehouse_items').find(i => i.user_id === DEMO_USER_ID && i.part_number === pn)
  if (!item) {
    if (delta < 0) falla(`STOCK_INSUFICIENTE:${pn}`)
    item = { id: uuid(), user_id: DEMO_USER_ID, part_number: pn, quantity: 0, created_at: ahoraIso(), updated_at: ahoraIso() }
    tabla('warehouse_items').push(item)
  }
  if (item.quantity + delta < 0) falla(`STOCK_INSUFICIENTE:${pn}`)
  item.quantity += delta
  item.updated_at = ahoraIso()
  tabla('warehouse_transactions').push({
    id: uuid(), user_id: DEMO_USER_ID, part_number: pn,
    quantity: tipo === 'ADJUSTMENT' ? delta : Math.abs(delta), type: tipo,
    source_type: origen, source_id: origenId, site: site || '', work_order: wo || '',
    motivo: motivo || '', created_by: DEMO_USER_ID, balance_after: item.quantity, created_at: ahoraIso(),
  })
  return item.quantity
}

// Repuestos de una lista/pedido agrupados por part number
function agrupar(items) {
  const mapa = new Map()
  for (const it of items) {
    const r = tabla('repuestos').find(x => x.id === it.spare_part_id)
    if (!r?.part_number?.trim()) continue
    const pn = r.part_number.trim()
    mapa.set(pn, (mapa.get(pn) || 0) + (it.quantity ?? 1))
  }
  return [...mapa].map(([pn, qty]) => ({ pn, qty }))
}

function sinPn(items) {
  const nombres = items
    .map(it => tabla('repuestos').find(x => x.id === it.spare_part_id))
    .filter(r => r && !r.part_number?.trim())
    .map(r => r.nombre)
  return nombres.length ? nombres.join(', ') : null
}

const RPC = {
  ajustar_stock({ p_part_number, p_tipo, p_cantidad, p_motivo, p_wo, p_site }) {
    const pn = String(p_part_number || '').trim()
    if (!pn) falla('PART_NUMBER_REQUERIDO')
    if (!['IN', 'OUT'].includes(p_tipo)) falla('TIPO_INVALIDO')
    if (!(p_cantidad >= 1)) falla('CANTIDAD_INVALIDA')
    const saldo = moverStock({
      pn, delta: p_tipo === 'IN' ? p_cantidad : -p_cantidad, tipo: p_tipo, origen: 'WAREHOUSE',
      site: p_site, wo: p_wo, motivo: p_motivo,
    })
    return { part_number: pn, quantity: saldo }
  },

  fijar_stock({ p_part_number, p_cantidad, p_motivo }) {
    const pn = String(p_part_number || '').trim()
    if (!pn) falla('PART_NUMBER_REQUERIDO')
    if (p_cantidad == null || p_cantidad < 0) falla('CANTIDAD_INVALIDA')
    if (!String(p_motivo || '').trim()) falla('MOTIVO_REQUERIDO')
    const actual = tabla('warehouse_items').find(i => i.user_id === DEMO_USER_ID && i.part_number === pn)?.quantity ?? 0
    if (actual === p_cantidad) return { part_number: pn, quantity: p_cantidad }
    const saldo = moverStock({
      pn, delta: p_cantidad - actual, tipo: 'ADJUSTMENT', origen: 'WAREHOUSE', motivo: String(p_motivo).trim(),
    })
    return { part_number: pn, quantity: saldo }
  },

  eliminar_item_almacen({ p_part_number }) {
    const pn = String(p_part_number || '').trim()
    const item = tabla('warehouse_items').find(i => i.user_id === DEMO_USER_ID && i.part_number === pn)
    if (!item) falla('NO_ENCONTRADO')
    if (item.quantity !== 0) falla('STOCK_NO_CERO')
    base.warehouse_items = tabla('warehouse_items').filter(i => i !== item)
    return null
  },

  actualizar_pedido({ p_pedido_id, p_wo, p_id_atm, p_site, p_modelo, p_direccion, p_items }) {
    const pedido = tabla('pedidos').find(p => p.id === p_pedido_id)
    if (!pedido) falla('PEDIDO_NO_ENCONTRADO')
    if (pedido.estado !== 'guardado') falla('PEDIDO_NO_EDITABLE')
    if (!Array.isArray(p_items) || !p_items.length) falla('PEDIDO_SIN_ITEMS')
    if (p_items.some(i => !i.spare_part_id || !(i.quantity >= 1))) falla('CANTIDAD_INVALIDA')
    if (p_items.some(i => !tabla('repuestos').some(r => r.id === i.spare_part_id))) falla('REPUESTO_NO_ENCONTRADO')
    const suma = new Map()
    for (const i of p_items) suma.set(i.spare_part_id, (suma.get(i.spare_part_id) || 0) + i.quantity)
    base.pedido_items = tabla('pedido_items').filter(i => i.pedido_id !== p_pedido_id)
    for (const [spare_part_id, quantity] of suma) {
      tabla('pedido_items').push({ id: uuid(), pedido_id: p_pedido_id, spare_part_id, quantity, created_at: ahoraIso() })
    }
    const ahora = ahoraIso()
    Object.assign(pedido, {
      wo: String(p_wo || '').trim(), id_atm: String(p_id_atm || '').trim(), site: String(p_site || '').trim(),
      modelo: String(p_modelo || '').trim(), direccion: String(p_direccion || '').trim(), updated_at: ahora,
    })
    return { ok: true, item_count: suma.size, updated_at: ahora }
  },

  recepcionar_pedido({ p_pedido_id, p_recepcionado_por_id, p_entregado_por_id }) {
    const pedido = tabla('pedidos').find(p => p.id === p_pedido_id)
    if (!pedido) falla('PEDIDO_NO_ENCONTRADO')
    if (pedido.estado === 'recepcionado') falla('PEDIDO_YA_RECEPCIONADO')
    const items = tabla('pedido_items').filter(i => i.pedido_id === p_pedido_id)
    if (!items.length) falla('PEDIDO_SIN_ITEMS')
    const sin = sinPn(items)
    if (sin) falla(`REPUESTO_SIN_PN:${sin}`)
    for (const { pn, qty } of agrupar(items)) {
      moverStock({ pn, delta: qty, tipo: 'IN', origen: 'ORDER', origenId: pedido.id, site: pedido.site, wo: pedido.wo, motivo: 'Recepción de pedido' })
    }
    const ahora = ahoraIso()
    const lista = {
      ...clonar(DEFECTOS.spare_part_lists),
      id: uuid(), user_id: DEMO_USER_ID,
      name: `Uso de repuestos - ${pedido.wo || pedido.id.slice(0, 8)}`,
      site: pedido.site, work_order: pedido.wo, created_at: ahora, updated_at: ahora,
    }
    tabla('spare_part_lists').push(lista)
    for (const i of items) {
      tabla('spare_part_list_items').push({ id: uuid(), list_id: lista.id, spare_part_id: i.spare_part_id, quantity: i.quantity, presupuesto: '', created_at: ahora })
    }
    const rec = tabla('pedidos_personas').find(p => p.id === p_recepcionado_por_id)
    const ent = tabla('pedidos_personas').find(p => p.id === p_entregado_por_id)
    Object.assign(pedido, {
      estado: 'recepcionado',
      recepcionado_por_id: rec ? rec.id : null, recepcionado_por_nombre: rec?.nombre || '',
      entregado_por_id: ent ? ent.id : null, entregado_por_nombre: ent?.nombre || '',
      recepcionado_at: ahora, updated_at: ahora,
    })
    return {
      lista: clonar(lista), item_count: items.length, recepcionado_at: ahora,
      recepcionado_por_nombre: rec?.nombre || '', entregado_por_nombre: ent?.nombre || '',
    }
  },

  consumir_lista({ p_list_id }) {
    const lista = tabla('spare_part_lists').find(l => l.id === p_list_id)
    if (!lista) falla('LISTA_NO_ENCONTRADA')
    if (lista.inventory_synced) falla('LISTA_YA_SINCRONIZADA')
    const items = tabla('spare_part_list_items').filter(i => i.list_id === p_list_id)
    if (!items.length) falla('LISTA_SIN_ITEMS')
    const sin = sinPn(items)
    if (sin) falla(`REPUESTO_SIN_PN:${sin}`)
    const grupos = agrupar(items)
    const faltantes = grupos
      .map(({ pn, qty }) => ({
        part_number: pn, requerido: qty,
        disponible: tabla('warehouse_items').find(i => i.user_id === DEMO_USER_ID && i.part_number === pn)?.quantity ?? 0,
      }))
      .filter(f => f.disponible < f.requerido)
    if (faltantes.length) return { ok: false, faltantes }
    for (const { pn, qty } of grupos) {
      moverStock({ pn, delta: -qty, tipo: 'OUT', origen: 'LIST', origenId: lista.id, site: lista.site, wo: lista.work_order, motivo: 'Consumo de lista' })
    }
    const ahora = ahoraIso()
    Object.assign(lista, { inventory_synced: true, inventory_synced_at: ahora, updated_at: ahora })
    return { ok: true, synced_at: ahora }
  },

  revertir_consumo_lista({ p_list_id, p_motivo }) {
    if (!String(p_motivo || '').trim()) falla('MOTIVO_REQUERIDO')
    const lista = tabla('spare_part_lists').find(l => l.id === p_list_id)
    if (!lista) falla('LISTA_NO_ENCONTRADA')
    if (!lista.inventory_synced) falla('LISTA_NO_SINCRONIZADA')
    const neto = new Map()
    for (const t of tabla('warehouse_transactions')) {
      if (t.source_type !== 'LIST' || t.source_id !== p_list_id) continue
      neto.set(t.part_number, (neto.get(t.part_number) || 0) + (t.type === 'OUT' ? t.quantity : t.type === 'ADJUSTMENT' ? -t.quantity : 0))
    }
    for (const [pn, cantidad] of neto) {
      if (cantidad > 0) {
        moverStock({ pn, delta: cantidad, tipo: 'ADJUSTMENT', origen: 'LIST', origenId: lista.id, site: lista.site, wo: lista.work_order, motivo: `Reversión de lista: ${String(p_motivo).trim()}` })
      }
    }
    Object.assign(lista, { inventory_synced: false, inventory_synced_at: null, updated_at: ahoraIso() })
    return { ok: true }
  },
}

function rpc(nombre, parametros = {}) {
  return Promise.resolve().then(() => {
    const fn = RPC[nombre]
    if (!fn) return { data: null, error: error('No disponible en modo demostración.') }
    try {
      const data = clonar(fn(parametros))
      guardar()
      return { data: data ?? null, error: null }
    } catch (e) {
      // Una falla a mitad de operación no debe dejar la demo a medias: se restaura lo guardado
      base = leerBaseGuardada() || base
      return { data: null, error: error(e.message) }
    }
  })
}

const auth = {
  async getSession() {
    return { data: { session: esModoDemo() ? DEMO_SESION : null }, error: null }
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } }
  },
  async signInWithPassword() {
    return { data: { session: DEMO_SESION, user: DEMO_SESION.user }, error: null }
  },
  async signOut() {
    base = null
    await salirModoDemo()
    return { error: null }
  },
  async updateUser() {
    return { data: null, error: error('No disponible en modo demostración.') }
  },
}

export const clienteDemo = {
  from: nombre => new Consulta(nombre),
  rpc,
  auth,
  functions: {
    invoke: async () => ({ data: null, error: error('No disponible en modo demostración.') }),
  },
}

export { DEMO_PERFIL }

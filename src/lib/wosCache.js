import { supabase } from './supabase'
import { db } from './db'

// Fila de Supabase -> registro Dexie
export function wosADexie(row) {
  return {
    idRemoto: row.id,
    userId: row.user_id,
    anio: row.anio || '',
    mes: row.mes || '',
    cliente: row.cliente || '',
    serie: row.serie || '',
    modelo: row.modelo || '',
    tipoPm: row.tipo_pm || '',
    codigoEquipo: row.codigo_equipo || '',
    nombreEquipo: row.nombre_equipo || '',
    site: row.site || '',
    direccion: row.direccion || '',
    distrito: row.distrito || '',
    provincia: row.provincia || '',
    departamento: row.departamento || '',
    lp: row.lp || '',
    funcionAtm: row.funcion_atm || '',
    horarioPv: row.horario_pv || '',
    restricciones: row.restricciones || '',
    responsableBoveda: row.responsable_boveda || '',
    wo: row.wo || '',
    fecha: row.fecha || '',
    hora: row.hora || '',
    horaPv: row.hora_pv || '',
    legajo: row.legajo || '',
    ce: row.ce || '',
    dni: row.dni || '',
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  }
}

// Registro Dexie -> forma de fila de Supabase (la que consumen las páginas)
export function wosDesdeDexie(w) {
  return {
    id: w.idRemoto,
    user_id: w.userId,
    anio: w.anio || '',
    mes: w.mes || '',
    cliente: w.cliente || '',
    serie: w.serie || '',
    modelo: w.modelo || '',
    tipo_pm: w.tipoPm || '',
    codigo_equipo: w.codigoEquipo || '',
    nombre_equipo: w.nombreEquipo || '',
    site: w.site || '',
    direccion: w.direccion || '',
    distrito: w.distrito || '',
    provincia: w.provincia || '',
    departamento: w.departamento || '',
    lp: w.lp || '',
    funcion_atm: w.funcionAtm || '',
    horario_pv: w.horarioPv || '',
    restricciones: w.restricciones || '',
    responsable_boveda: w.responsableBoveda || '',
    wo: w.wo || '',
    fecha: w.fecha || '',
    hora: w.hora || '',
    hora_pv: w.horaPv || '',
    legajo: w.legajo || '',
    ce: w.ce || '',
    dni: w.dni || '',
    created_at: w.creadoEn,
    updated_at: w.actualizadoEn,
  }
}

// Reemplaza el caché local de forma atómica: si algo falla, queda el caché anterior.
export async function guardarCacheWos(filas) {
  await db.transaction('rw', db.workorders, async () => {
    await db.workorders.clear()
    if (filas?.length) await db.workorders.bulkAdd(filas.map(wosADexie))
  })
}

// Descarga todas las WO visibles para el usuario y refresca el caché. Lanza si falla.
export async function refrescarCacheWos() {
  const { data, error } = await supabase
    .from('workorders')
    .select('*')
    .order('fecha', { ascending: false })
    .order('wo')
  if (error) throw error
  await guardarCacheWos(data || [])
  return data || []
}

export async function leerCacheWos() {
  const local = await db.workorders.orderBy('localId').reverse().toArray()
  return local.map(wosDesdeDexie)
}

// Site mostrado/copiado: `site` y, si falta, `nombre_equipo`
export function siteDeWo(w) {
  return w?.site || w?.nombre_equipo || ''
}

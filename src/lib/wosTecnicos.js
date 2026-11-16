import { supabase } from './supabase'

const CLAVE_NOMBRES = 'wos_nombres_tecnicos'

export function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

export function normalizarLegajo(texto) {
  return String(texto || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
}

export function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function leerCacheNombres() {
  try {
    const obj = JSON.parse(localStorage.getItem(CLAVE_NOMBRES) || '{}')
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

function guardarCacheNombres(obj) {
  try {
    localStorage.setItem(CLAVE_NOMBRES, JSON.stringify(obj))
  } catch { /* sin almacenamiento disponible */ }
}

// Devuelve un mapa de nombres: { [userId]: nombre, ['legajo:PE101L84']: nombre }.
// Los perfiles son legibles por todos, así que se leen todos de una vez.
// Si no hay conexión, usa el último resultado guardado.
export async function cargarNombresTecnicos() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, legajo')
    if (error) throw error
    const nuevo = {}
    for (const p of data || []) {
      const nombre = (p.full_name || '').trim() || p.username || ''
      nuevo[p.id] = nombre
      const leg = normalizarLegajo(p.legajo)
      if (leg && nombre) nuevo[`legajo:${leg}`] = nombre
    }
    guardarCacheNombres(nuevo)
    return nuevo
  } catch {
    return leerCacheNombres()
  }
}

// Nombre del técnico de una WO: el CE del Excel (es el nombre del técnico asignado); si falta,
// el perfil que tiene ese legajo y, por último, el usuario dueño de la WO.
export function nombreDeWo(w, nombres) {
  if (!w) return ''
  const ce = String(w.ce || '').trim()
  if (ce) return ce
  if (!nombres) return ''
  const leg = normalizarLegajo(w.legajo)
  return (leg && nombres[`legajo:${leg}`]) || nombres[w.userId ?? w.user_id] || ''
}

// Lunes y domingo de la semana de la fecha dada (AAAA-MM-DD)
export function rangoSemana(fechaIso) {
  const [a, m, d] = fechaIso.split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1, d))
  const dia = base.getUTCDay() || 7
  const lunes = new Date(base)
  lunes.setUTCDate(base.getUTCDate() - (dia - 1))
  const domingo = new Date(lunes)
  domingo.setUTCDate(lunes.getUTCDate() + 6)
  const iso = f => f.toISOString().slice(0, 10)
  return { desde: iso(lunes), hasta: iso(domingo) }
}

// Aplica los filtros de búsqueda a una WO (forma Dexie: userId, legajo, fecha…)
export function coincideFiltros(w, filtros, nombres) {
  if (filtros.desde && String(w.fecha || '') < filtros.desde) return false
  if (filtros.hasta && String(w.fecha || '') > filtros.hasta) return false
  if (filtros.legajo && normalizarLegajo(w.legajo) !== filtros.legajo) return false

  const tokens = normalizarTexto(filtros.texto).split(/\s+/).filter(Boolean)
  if (tokens.length) {
    const nombre = nombreDeWo(w, nombres)
    const campos = [
      w.wo,
      w.codigoEquipo ?? w.codigo_equipo,
      w.site || w.nombreEquipo || w.nombre_equipo,
      w.legajo,
      w.distrito,
      w.serie,
      nombre,
    ].map(normalizarTexto)
    if (!tokens.every(t => campos.some(c => c.includes(t)))) return false
  }
  return true
}

export function hayFiltros(f) {
  return Boolean(f && (f.texto?.trim() || f.desde || f.hasta || f.legajo))
}

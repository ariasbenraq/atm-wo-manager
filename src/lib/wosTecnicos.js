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

// Devuelve { [userId]: nombre } para los usuarios dados.
// Si no hay conexión, usa el último resultado guardado.
export async function cargarNombresTecnicos(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const cache = leerCacheNombres()
  if (!ids.length) return cache

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', ids)
    if (error) throw error
    const nuevo = { ...cache }
    for (const p of data || []) {
      nuevo[p.id] = (p.full_name || '').trim() || p.username || ''
    }
    guardarCacheNombres(nuevo)
    return nuevo
  } catch {
    return cache
  }
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
    const nombre = nombres?.[w.userId ?? w.user_id] || ''
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

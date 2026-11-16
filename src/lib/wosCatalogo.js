// Catálogo de WOs para elegir en formularios (Pedidos, Mis listas): ordenado por cercanía de fecha
// y filtrado por legajo. Una WO reprogramada aparece una sola vez, con su fecha más relevante.
import { supabase } from './supabase'
import { leerCacheWos } from './wosCache'
import { normalizarLegajo } from './wosTecnicos'

export const CAMPOS_CATALOGO_WO =
  'wo, legajo, codigo_equipo, nombre_equipo, modelo, site, direccion, serie, distrito, fecha'

function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

// 0 = hoy, 1 = días posteriores, 2 = días anteriores o sin fecha
function rangoFecha(fecha, hoy) {
  if (!fecha) return 2
  if (fecha === hoy) return 0
  return fecha > hoy ? 1 : 2
}

// Hoy primero, luego días posteriores (ascendente) y al final los anteriores (más reciente primero).
export function ordenarWosCatalogo(lista) {
  const hoy = hoyLima()
  const ordenadas = [...lista].sort((a, b) => {
    const ra = rangoFecha(a.fecha, hoy)
    const rb = rangoFecha(b.fecha, hoy)
    if (ra !== rb) return ra - rb
    const cmp = String(a.fecha || '').localeCompare(String(b.fecha || ''))
    return ra === 2 ? -cmp : cmp
  })
  const vistas = new Set()
  const unicas = []
  for (const w of ordenadas) {
    const wo = String(w.wo || '').trim()
    if (!wo || vistas.has(wo)) continue
    vistas.add(wo)
    unicas.push({ ...w, wo })
  }
  return unicas
}

// WOs asociadas al legajo dado (vacío si el legajo no está asignado)
export function filtrarWosPorLegajo(wos, legajo) {
  const mio = normalizarLegajo(legajo)
  if (!mio) return []
  return wos.filter(w => normalizarLegajo(w.legajo) === mio)
}

// Descarga las WOs visibles (con respaldo local sin conexión), ya ordenadas y filtradas por legajo
export async function cargarWosDeLegajo(legajo) {
  let filas
  try {
    const { data, error } = await supabase.from('workorders').select(CAMPOS_CATALOGO_WO)
    if (error) throw error
    filas = data || []
  } catch {
    filas = await leerCacheWos()
  }
  return ordenarWosCatalogo(filtrarWosPorLegajo(filas, legajo))
}

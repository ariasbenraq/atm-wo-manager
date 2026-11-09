import { normalizarEncabezado } from './excel'

// Alias de encabezados (ya normalizados con normalizarEncabezado) -> campo de la tabla `workorders`.
// customer_code -> cliente, atm_id -> codigo_equipo (no hace falta migración).
export const MAPEO_COLUMNAS = {
  'ano': 'anio',
  'mes': 'mes',
  'cliente': 'cliente',
  'customer code': 'cliente',
  'n de serie': 'serie',
  'numero de serie': 'serie',
  'serie': 'serie',
  'modelo': 'modelo',
  'tipo pm': 'tipo_pm',
  'codigo del equipo': 'codigo_equipo',
  'id atm/kiosko': 'codigo_equipo',
  'id atm kiosko': 'codigo_equipo',
  'nombre del equipo': 'nombre_equipo',
  'site': 'site',
  'direccion': 'direccion',
  'distrito': 'distrito',
  'provincia': 'provincia',
  'departamento': 'departamento',
  'l/p': 'lp',
  'funcion atm': 'funcion_atm',
  'horario con pv': 'horario_pv',
  'restricciones / documentacion': 'restricciones',
  'restricciones documentacion': 'restricciones',
  'responsable boveda etv/oficina': 'responsable_boveda',
  'responsable boveda etv oficina': 'responsable_boveda',
  'wo': 'wo',
  'fecha': 'fecha',
  'hora': 'hora',
  'hora pv': 'hora_pv',
  'legajo': 'legajo',
  'ce': 'ce',
  'dni': 'dni',
}

const SITES_DESCARTADOS = new Set(['agencia', 'neutro'])

export function texto(valor) {
  return String(valor ?? '').trim()
}

export function mapearFila(fila) {
  const resultado = {}
  for (const [clave, valor] of Object.entries(fila)) {
    const campo = MAPEO_COLUMNAS[normalizarEncabezado(clave)]
    if (!campo) continue
    // Si dos columnas alias apuntan al mismo campo, la primera con valor gana.
    if (texto(resultado[campo]) === '' || resultado[campo] === undefined) resultado[campo] = valor
  }
  return resultado
}

// Regla de SITE: 1) Site (si no es Agencia/Neutro), 2) Nombre del Equipo, 3) vacío.
export function resolverSite(cruda) {
  const site = texto(cruda.site)
  if (site && !SITES_DESCARTADOS.has(normalizarEncabezado(site))) return site
  return texto(cruda.nombre_equipo)
}

// Completa los campos vacíos de `base` con los de `otro`, sin pisar valores válidos.
export function fusionarVacios(base, otro) {
  const resultado = { ...base }
  for (const [campo, valor] of Object.entries(otro || {})) {
    if (texto(resultado[campo]) === '' && texto(valor) !== '') resultado[campo] = valor
  }
  return resultado
}

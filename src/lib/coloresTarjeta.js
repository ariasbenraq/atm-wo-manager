// Colores de fondo de las tarjetas de WO según el legajo: Lima (PE101L…) o Regiones (PE101R…).
// Se guarda la CLAVE del color (no el hex): cada clave tiene su versión clara y oscura, ya elegidas
// para que el texto de la tarjeta se lea con contraste suficiente.

export const PALETA = [
  { clave: 'ninguno', nombre: 'Sin color', clases: 'bg-content1', muestra: 'bg-content1 border border-default-300' },
  { clave: 'azul', nombre: 'Azul', clases: 'bg-blue-100 dark:bg-blue-500/20', muestra: 'bg-blue-300' },
  { clave: 'celeste', nombre: 'Celeste', clases: 'bg-sky-100 dark:bg-sky-500/20', muestra: 'bg-sky-300' },
  { clave: 'verde', nombre: 'Verde', clases: 'bg-green-100 dark:bg-green-500/20', muestra: 'bg-green-300' },
  { clave: 'menta', nombre: 'Menta', clases: 'bg-emerald-100 dark:bg-emerald-500/20', muestra: 'bg-emerald-300' },
  { clave: 'amarillo', nombre: 'Amarillo', clases: 'bg-yellow-100 dark:bg-yellow-500/20', muestra: 'bg-yellow-300' },
  { clave: 'naranja', nombre: 'Naranja', clases: 'bg-orange-100 dark:bg-orange-500/20', muestra: 'bg-orange-300' },
  { clave: 'rosa', nombre: 'Rosa', clases: 'bg-rose-100 dark:bg-rose-500/20', muestra: 'bg-rose-300' },
  { clave: 'morado', nombre: 'Morado', clases: 'bg-purple-100 dark:bg-purple-500/20', muestra: 'bg-purple-300' },
  { clave: 'gris', nombre: 'Gris', clases: 'bg-slate-200 dark:bg-slate-500/25', muestra: 'bg-slate-400' },
]

export const COLORES_POR_DEFECTO = { lima: 'azul', regiones: 'naranja' }

export const GRUPOS = [
  { clave: 'lima', etiqueta: 'Lima', ejemplo: 'PE101L…' },
  { clave: 'regiones', etiqueta: 'Regiones', ejemplo: 'PE101R…' },
]

// 'PE101L84' -> 'lima'; 'PE101R06' / 'PE904R02' -> 'regiones'; cualquier otro -> null
export function grupoDeLegajo(legajo) {
  const m = String(legajo || '').replace(/[^a-z0-9]/gi, '').toUpperCase().match(/^PE\d{3}([LR])/)
  if (!m) return null
  return m[1] === 'L' ? 'lima' : 'regiones'
}

export function clasesDeColor(clave) {
  return (PALETA.find(c => c.clave === clave) || PALETA[0]).clases
}

// Repuestos que consume cada visita a un ATM de ciertos modelos.
// Cada ATM de estos modelos usa siempre 1 filtro y 8 ventosas.
export const MODELOS_CON_KIT = ['6623', '6627', '6628', '6612']

export const KIT_POR_ATM = [
  { part_number: '4450773447', nombre: 'Filtro', porAtm: 1 },
  { part_number: '0090035910', nombre: 'Ventosas (S2 suction cup blue)', porAtm: 8 },
]

export function normalizarPartNumber(pn) {
  return String(pn || '').replace(/\s+/g, '').toUpperCase()
}

// '6627-3000-8200' -> '6627'. Devuelve '' si no empieza con 4 dígitos.
export function familiaModelo(modelo) {
  const m = String(modelo || '').trim().match(/^(\d{4})/)
  return m ? m[1] : ''
}

export function usaKit(modelo) {
  return MODELOS_CON_KIT.includes(familiaModelo(modelo))
}

// wos: WOs del periodo. stock / entrante: Map(part_number normalizado -> unidades) o null si no se pudo leer.
export function calcularKit(wos, stock, entrante) {
  const atms = (wos || []).filter(w => usaKit(w.modelo))
  const partes = KIT_POR_ATM.map(k => {
    const clave = normalizarPartNumber(k.part_number)
    const necesario = atms.length * k.porAtm
    const enStock = stock ? (stock.get(clave) || 0) : null
    const porRecibir = entrante ? (entrante.get(clave) || 0) : 0
    const faltante = enStock === null ? null : Math.max(0, necesario - enStock)
    const aSolicitar = faltante === null ? null : Math.max(0, faltante - porRecibir)
    let estado = 'desconocido'
    if (faltante !== null) {
      if (faltante === 0) estado = 'ok'
      else if (faltante <= porRecibir) estado = 'cubierto'
      else estado = 'falta'
    }
    return { ...k, necesario, enStock, porRecibir, faltante, aSolicitar, estado }
  })
  return {
    atms: atms.length,
    omitidas: (wos || []).length - atms.length,
    partes,
    hayFalta: partes.some(p => p.estado === 'falta'),
    hayCubierto: partes.some(p => p.estado === 'cubierto'),
  }
}

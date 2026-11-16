import { supabase } from './supabase'
import { hoyLima, rangoSemana } from './wosTecnicos'

function sumarCantidades(items) {
  return (items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
}

// Resumen de WOs a partir de la lista ya cargada (filas con user_id, wo, fecha, hora, site…)
export function resumirWos(wos, userId) {
  const hoy = hoyLima()
  const fin = rangoSemana(hoy).hasta
  const propias = (wos || []).filter(w => !userId || w.user_id === userId)
  const deHoy = propias
    .filter(w => w.fecha === hoy)
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')))
  const semana = propias.filter(w => w.fecha >= hoy && w.fecha <= fin)
  return { hoy, fin, deHoy, semana, propias }
}

// Partes (unidades) de pedidos cuya WO cae en hoy / en el resto de la semana.
// `porRecibir` son las de pedidos aún en estado «guardado».
export function resumirPartes(pedidos, propias, hoy, fin) {
  const fechasPorWo = new Map()
  for (const w of propias) {
    if (!w.wo) continue
    const lista = fechasPorWo.get(w.wo) || []
    lista.push(w.fecha)
    fechasPorWo.set(w.wo, lista)
  }
  const vacio = () => ({ total: 0, porRecibir: 0, pedidos: 0 })
  const resultado = { hoy: vacio(), semana: vacio() }

  for (const p of pedidos || []) {
    const fechas = fechasPorWo.get(p.wo) || []
    const unidades = sumarCantidades(p.pedido_items)
    const porRecibir = p.estado === 'guardado' ? unidades : 0
    const enHoy = fechas.includes(hoy)
    const enSemana = fechas.some(f => f >= hoy && f <= fin)
    if (enHoy) {
      resultado.hoy.total += unidades
      resultado.hoy.porRecibir += porRecibir
      resultado.hoy.pedidos += 1
    }
    if (enSemana) {
      resultado.semana.total += unidades
      resultado.semana.porRecibir += porRecibir
      resultado.semana.pedidos += 1
    }
  }
  return resultado
}

// Pedidos y listas desde Supabase. Cada parte puede fallar por separado (sin conexión).
export async function cargarResumenRemoto(userId) {
  const [pedidosRes, listasRes] = await Promise.allSettled([
    supabase
      .from('pedidos')
      .select('id, wo, estado, pedido_items(quantity)')
      .eq('user_id', userId),
    supabase
      .from('spare_part_lists')
      .select('id, name, spare_part_list_items(quantity)')
      .eq('user_id', userId)
      .eq('inventory_synced', false),
  ])

  const ok = r => r.status === 'fulfilled' && !r.value.error

  const pedidos = ok(pedidosRes) ? (pedidosRes.value.data || []) : null
  const listas = ok(listasRes)
    ? (listasRes.value.data || [])
        .map(l => ({ id: l.id, name: l.name, partes: sumarCantidades(l.spare_part_list_items) }))
        .filter(l => l.partes > 0)
    : null

  return {
    pedidos,
    listas,
    pedidosPorRecibir: pedidos ? pedidos.filter(p => p.estado === 'guardado').length : null,
  }
}

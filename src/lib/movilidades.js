import { normalizarLegajo } from './wosTecnicos'
import { TRANSPORTES_MOV, TRASLADO_IDA, TRASLADO_RETORNO, STATUS_WO_MOV } from './googleFormMovilidad'

const DESCRIPCION_POR_DEFECTO = 'Mantenimiento Preventivo'
const STATUS_POR_DEFECTO = STATUS_WO_MOV[2] // CERRADO

export const MARGEN_MINUTOS = 45

function aMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function deMinutos(min) {
  const t = Math.max(0, min)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function lugarDeWo(w) {
  return {
    distrito: (w.distrito || w.provincia || w.departamento || '').trim(),
    direccion: (w.direccion || '').trim(),
  }
}

// Arma los tramos del día para el legajo: domicilio → WO1 → … → WOn → domicilio.
// Solo considera WOs del legajo indicado (sin legajo no hay tramos).
export function armarTramos({ wos, legajo, fecha, domicilio }) {
  const mio = normalizarLegajo(legajo)
  const delDia = mio
    ? (wos || [])
        .filter(w => normalizarLegajo(w.legajo) === mio && w.fecha === fecha && w.wo)
        .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')) || String(a.wo).localeCompare(String(b.wo)))
    : []
  const casa = { distrito: (domicilio?.distrito || '').trim(), direccion: (domicilio?.direccion || '').trim() }
  const tipoAtencion = delDia.length > 1 ? 'Ruta' : 'Local'
  const rutaWos = delDia.length > 1 ? delDia.map(w => `${w.wo} - ${w.cliente || ''}`.trim()).join(', ') : ''
  const base = { fecha, tipoAtencion, rutaWos, transporte: TRANSPORTES_MOV[0], costo: '', informe: '', descripcion: DESCRIPCION_POR_DEFECTO, status: STATUS_POR_DEFECTO }

  const tramos = delDia.map((w, i) => {
    const previa = i > 0 ? delDia[i - 1] : null
    const hDest = aMinutos(w.hora)
    const hOrigen = previa ? aMinutos(previa.hora) : null
    let hora = ''
    if (hDest !== null) {
      const sugerida = hDest - MARGEN_MINUTOS
      hora = deMinutos(hOrigen !== null ? Math.max(hOrigen, sugerida) : sugerida)
    }
    return {
      ...base,
      clave: `${fecha}|${i}|${w.wo}`,
      wo: w.wo,
      cliente: w.cliente || '',
      origen: previa ? lugarDeWo(previa) : casa,
      origenEtiqueta: previa ? previa.wo : 'Domicilio',
      destino: lugarDeWo(w),
      destinoEtiqueta: w.wo,
      hora,
      tipoTraslado: TRASLADO_IDA,
      esRetorno: false,
    }
  })

  if (delDia.length) {
    const ultima = delDia[delDia.length - 1]
    tramos.push({
      ...base,
      clave: `${fecha}|ret|${ultima.wo}`,
      wo: ultima.wo,
      cliente: ultima.cliente || '',
      origen: lugarDeWo(ultima),
      origenEtiqueta: ultima.wo,
      destino: casa,
      destinoEtiqueta: 'Domicilio',
      hora: '',
      tipoTraslado: TRASLADO_RETORNO,
      esRetorno: true,
    })
  }
  return { tramos, wosDelDia: delDia }
}

// Datos obligatorios del formulario que faltan en el tramo (lista de etiquetas)
export function faltantesTramo(tramo) {
  const f = []
  if (!tramo.origen.distrito) f.push('distrito de origen')
  if (!tramo.origen.direccion) f.push('dirección de partida')
  if (!tramo.destino.distrito) f.push('distrito de destino')
  if (!tramo.destino.direccion) f.push('dirección de llegada')
  if (!/^\d{1,2}:\d{2}/.test(tramo.hora || '')) f.push('hora de inicio')
  if (!String(tramo.informe || '').trim()) f.push('N° de informe (000000 si no existe)')
  if (String(tramo.costo ?? '').trim() === '' || Number(tramo.costo) < 0 || Number.isNaN(Number(tramo.costo))) f.push('costo')
  return f
}

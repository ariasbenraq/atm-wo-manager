// Enlace prellenado del Google Form «FORMULARIO GASTOS DE MOVILIDAD» (Iderka Peru).
// Los ids salen del HTML del formulario; los valores de listas/radios deben coincidir exactamente con sus opciones.
export const FORM_BASE_MOVILIDAD =
  'https://docs.google.com/forms/d/e/1FAIpQLSfgKZxFNogaz0Bl8lCvh1ZL6X3jGQLxFYXNYCD-Ip2a-GNVbA/viewform'

export const CAMPO_MOV = {
  fecha: 516203387,
  legajo: 1671231169,
  transporte: 1159069410,
  distritoOrigen: 2050767858,
  direccionPartida: 1143069698,
  horaInicio: 300545891,
  distritoDestino: 110909810,
  direccionLlegada: 285496267,
  tipoGasto: 1551524904,
  wo: 2795927,
  descripcion: 1472710374,
  status: 8026674,
  informe: 970390922,
  tipoAtencion: 994936063,
  cliente: 413776622,
  tipoTraslado: 1680724518,
  costo: 194755894,
  otrosGastos: 689078403,
  multipleRuta: 1481752825,
  wosRuta: 1272226855,
}

export const TRANSPORTES_MOV = ['Movilidad Taxi', 'Transporte Local (Bus Interprovincial u otros)']
export const STATUS_WO_MOV = ['PROGRAMADA', 'SUSPENDIDA', 'CERRADO']
export const TIPO_GASTO_WO = 'Asociados a WORKORDER'
export const TRASLADO_IDA = 'Traslado atención'
export const TRASLADO_RETORNO = 'Retorno de atención'

export const LEGAJOS_MOVILIDAD = [
  'PELVISYAC', 'PJOSEALAR', 'PRODOLFOL', 'PROBRUCAP', 'PE101L44', 'PROLUCAS', 'PE101L03', 'PE101L09',
  'PE101L15', 'PE101L27', 'PE101L28', 'PE101L29', 'PE101L45', 'PE101L46', 'PE101L53', 'PE101L55',
  'PE101L57', 'PE101L58', 'PE101L60', 'PE101L63', 'PE101L64', 'PE101L65', 'PE101L68', 'PE101L71',
  'PE101L76', 'PE101L77', 'PE101L81', 'PE101L82', 'PE101L83', 'PE101L84', 'PE101L92', 'PE101R01',
  'PE101R03', 'PE101R04', 'PE101R05', 'PE101R07', 'PE101R08', 'PE101R14', 'PE101R16', 'PE101R24',
  'PE101R31', 'PE101R58', 'PE101R59', 'PE101R67', 'PE101R77', 'PE101R80', 'PE101R81', 'PE101R84',
  'PE101R87', 'PE101R88', 'PE910C90', 'PE910C91', 'PE910C92', 'PE910C93', 'PE910C94', 'PE910C95',
  'PE910C96', 'PE101L21', 'PE901R02', 'PE101R57', 'PE901R07', 'PE101L10', 'PE101L11', 'PE901R08',
  'PE901R09', 'PE101R19', 'PEBRAPOR', 'PEWALRIM', 'PERENARI', 'PEJOSRUI', 'PE101L16', 'PEJESUSG',
  'PEMIGUEV', 'PEGAMDAR', 'PESHENAP', 'PEMIGMAU', 'PE101L59', 'PE101L85', 'PE101L01', 'PE101L23',
  'PE901R03', 'PEJOSRIV',
]

export const CLIENTES_MOVILIDAD = [
  'BANCO DE CREDITO DEL PERU', 'BANCO CONTINENTAL', 'INTERBANK', 'BANCO DE LA NACION',
  'CENCOSUD PERU S.A.', 'SAGA FALABELLA S.A.', 'HIPERMERCADOS TOTTUS S.A.', 'SUPERMERCADOS PERUANOS S.A.',
  'CAJA MUNICIPAL DE AREQUIPA', 'BANCO FALABELLA', 'ECKERD PERU SA', 'SOLANA COMERCIAL',
  'REPSOL COMERCIAL SAC.', 'MIFARMA S.A.C.', 'CMAC CUSCO', 'BEMBOS S.A.C.',
  'CORPORACION PERUANA DE RESTAURANTES', 'CORPORACION PRIMAX', 'MAKRO SUPERMAYORISTA S.A.', 'LAN Peru S.A.',
  'NCR DEL PERU S.A.', 'EP DE FRANQUICIAS S.A.C', 'SERVIC.COMPARTIDOS DE RESTAURANTES', 'ALERT DEL PERU S.A.',
  'NUTRA S.A.', 'JORSA DE LA SELVA S.A.C.', 'RESTAURANTES S.A.C', 'TIENDAS PERUANAS S.A.', 'UNIBANCA SA.',
  'HOMECENTERS PERUANOS S.A.', 'GMD S.A.', 'Miniso', 'NGR', 'ALMACEN DE SAVAR', 'Entura PERU',
  'PROFUTURO AFP', 'Almacen NCR', 'NCR ITS GPS', 'Almacen TSI', 'ALMACEN COSESA', 'INKAFARMA',
  'ALMACEN PACHACAMAC', 'VERITAS PERU', 'OPERACIONES ARCOS DORADOS D PERU SA', 'ADIDAS', 'AT&T', '3M',
  'Sherwin-Williams Peru S.R.L.',
]

const PATRONES_CLIENTE_MOV = [
  [/credito|bcp/, 'BANCO DE CREDITO DEL PERU'],
  [/continental|bbva/, 'BANCO CONTINENTAL'],
  [/nacion|\bbn\b/, 'BANCO DE LA NACION'],
  [/interbank|ibk/, 'INTERBANK'],
  [/arequipa|cmac a|cmca/, 'CAJA MUNICIPAL DE AREQUIPA'],
  [/cusco|cmcp/, 'CMAC CUSCO'],
  [/banco falabella/, 'BANCO FALABELLA'],
  [/saga|falabella/, 'SAGA FALABELLA S.A.'],
  [/at\s*&?\s*t\b|att/, 'AT&T'],
]

export function legajoParaMovilidad(texto) {
  const t = String(texto || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
  return LEGAJOS_MOVILIDAD.includes(t) ? t : ''
}

// Texto libre del Excel -> opción del formulario, o '' si no coincide
export function clienteParaMovilidad(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (!t) return ''
  const exacto = CLIENTES_MOVILIDAD.find(c => c.toLowerCase() === t)
  if (exacto) return exacto
  return PATRONES_CLIENTE_MOV.find(([re]) => re.test(t))?.[1] || ''
}

// tramo: ver armarTramos (lib/movilidades.js). email/legajo ya validados por quien llama.
export function construirUrlMovilidad({ tramo, email, legajo }) {
  const p = new URLSearchParams()
  const poner = (campo, valor) => {
    const v = String(valor ?? '').trim()
    if (v) p.set(`entry.${campo}`, v)
  }
  p.set('usp', 'pp_url')
  if (email) p.set('emailAddress', email)
  poner(CAMPO_MOV.legajo, legajo)
  const [a, m, d] = String(tramo.fecha || '').split('-')
  if (a && m && d) {
    p.set(`entry.${CAMPO_MOV.fecha}_year`, String(Number(a)))
    p.set(`entry.${CAMPO_MOV.fecha}_month`, String(Number(m)))
    p.set(`entry.${CAMPO_MOV.fecha}_day`, String(Number(d)))
  }
  poner(CAMPO_MOV.transporte, tramo.transporte)
  poner(CAMPO_MOV.distritoOrigen, tramo.origen.distrito)
  poner(CAMPO_MOV.direccionPartida, tramo.origen.direccion)
  const hm = /^(\d{1,2}):(\d{2})/.exec(tramo.hora || '')
  if (hm) {
    p.set(`entry.${CAMPO_MOV.horaInicio}_hour`, String(Number(hm[1])))
    p.set(`entry.${CAMPO_MOV.horaInicio}_minute`, String(Number(hm[2])))
  }
  poner(CAMPO_MOV.distritoDestino, tramo.destino.distrito)
  poner(CAMPO_MOV.direccionLlegada, tramo.destino.direccion)
  poner(CAMPO_MOV.tipoGasto, TIPO_GASTO_WO)
  poner(CAMPO_MOV.wo, tramo.wo)
  poner(CAMPO_MOV.descripcion, String(tramo.descripcion || '').slice(0, 60))
  if (STATUS_WO_MOV.includes(tramo.status)) poner(CAMPO_MOV.status, tramo.status)
  poner(CAMPO_MOV.informe, tramo.informe)
  poner(CAMPO_MOV.tipoAtencion, tramo.tipoAtencion)
  poner(CAMPO_MOV.cliente, clienteParaMovilidad(tramo.cliente))
  poner(CAMPO_MOV.tipoTraslado, tramo.tipoTraslado)
  poner(CAMPO_MOV.costo, tramo.costo)
  poner(CAMPO_MOV.otrosGastos, 'NO')
  if (tramo.rutaWos) {
    poner(CAMPO_MOV.multipleRuta, 'SI')
    poner(CAMPO_MOV.wosRuta, tramo.rutaWos)
  }
  return `${FORM_BASE_MOVILIDAD}?${p.toString()}`
}

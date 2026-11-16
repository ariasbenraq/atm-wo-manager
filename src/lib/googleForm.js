// Google Form «Consumo de repuestos»: identificadores de campo y construcción del enlace prellenado.
// Los identificadores salen del propio formulario; si el formulario se rehace, hay que regenerarlos.

const FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSfuWkTiqfNeFbtB_TJSM8KQmEQW1LvfgSq1dCPWDWS3Bhv4eg/viewform'

export const MAX_REPUESTOS_POR_ENVIO = 7
export const ZONA_FORM = 'LIMA'

const CAMPO = {
  wo: 937665333,
  legajo: 876282841,
  zona: 1340755461,
  cliente: 761675048,
  fecha: 696919929,
  cantidad: 770263447,
}

// Por cada cantidad de repuestos (1..7), el formulario muestra una sección distinta.
// Cada fila es [part number, cantidad, N° de presupuesto].
const SECCIONES = {
  1: [[691137244, 1996691717, 61676411]],
  2: [[2125791115, 346954039, 98542692], [1391651329, 819656817, 815425302]],
  3: [[856781364, 1541835787, 1343438185], [372247569, 1740993951, 1917860660], [121084427, 856373658, 21652860]],
  4: [[747195462, 1147243648, 419412658], [1026487941, 700010404, 503044864], [492333131, 992941904, 1138620066], [1499535869, 215982535, 1432177998]],
  5: [[1206699479, 1949246758, 23811235], [2074269888, 309715508, 108990328], [1626150273, 488383591, 1041127578], [851212162, 1309335490, 1249231688], [2076709803, 1377600972, 1490644525]],
  6: [[43003967, 1188404503, 450346860], [474218377, 1092684020, 1332674347], [1045979178, 69604255, 1303816165], [1052230577, 320564277, 132628128], [1831953631, 734635779, 114166536], [1409642974, 1244656539, 362508434]],
  7: [[1622640595, 80677276, 2030789526], [1582194104, 2109256138, 194941138], [17355909, 603921661, 879818450], [2043729314, 1885021334, 1897096441], [1205032502, 730938818, 1150533521], [1192923260, 1274312639, 1231011363], [1718945658, 524545914, 1691415478]],
}

// Opciones del desplegable «LEGAJO o CSR» del formulario
export const LEGAJOS_FORM = [
  'PE101R01',
  'PE101R02',
  'PE101R06',
  'PE101R07',
  'PE101R08',
  'PE101R14',
  'PE101R16',
  'PE101R24',
  'PE101R31',
  'PE101R32',
  'PE101R39',
  'PE101R45',
  'PE101R46',
  'PE101R58',
  'PE101R59',
  'PE101R61',
  'PE101R62',
  'PE101R63',
  'PE101R65',
  'PE101R67',
  'PE101R77',
  'PE101R79',
  'PE101R81',
  'PE101R83',
  'PE101R84',
  'PE101R85',
  'PE101R86',
  'PE101R87',
  'PE101R88',
  'PE101R89',
  'PE101R92',
  'PE101R94',
  'PE101R97',
  'PE101R98',
  'PE904R02',
  'PE101R04',
  'PE101R05',
  'PE101R68',
  'PE101R80',
  'PE101R03',
  'PE101R57',
  'PE901R08',
  'PE101R48',
  'PE901R07',
  'PE901R02',
  'PE901R03',
  'PE101R30',
  'PE101R23',
  'PE901R09',
  'PE101R33',
  'PE101L01',
  'PE101L59',
  'PE101L23',
  'PE101L21',
  'PE101L44',
  'PE101L57',
  'PE101L65',
  'PE101L76',
  'PE101L83',
  'PE101L84',
  'PE101L85',
  'PE101L09',
  'PE101L27',
  'PE101L45',
  'PE101L55',
  'PE101L60',
  'PE101L77',
  'PE101R40',
]

// Legajo del perfil (cualquier mayúscula/espacio) -> opción del formulario, o '' si no existe en la lista
export function legajoParaForm(texto) {
  const t = String(texto || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
  return LEGAJOS_FORM.includes(t) ? t : ''
}

export const CLIENTES_FORM = [
  'BANCO DE CREDITO DEL PERU',
  'BANCO CONTINENTAL',
  'BANCO DE LA NACION',
  'INTERBANK',
  'CAJA MUNICIPAL AREQUIPA',
  'CMAC CUSCO',
  'BANCO FALABELLA',
  'AT&t PERU',
]

const PATRONES_CLIENTE = [
  [/credito|bcp/, 'BANCO DE CREDITO DEL PERU'],
  [/continental|bbva/, 'BANCO CONTINENTAL'],
  [/nacion|\bbn\b/, 'BANCO DE LA NACION'],
  [/interbank|ibk/, 'INTERBANK'],
  [/arequipa|cmac a|cmca/, 'CAJA MUNICIPAL AREQUIPA'],
  [/cusco|cmcp/, 'CMAC CUSCO'],
  [/falabella/, 'BANCO FALABELLA'],
  [/at\s*&?\s*t\b|att/, 'AT&t PERU'],
]

// Texto libre del Excel («Interbank», «Banco de Crédito»…) -> opción del formulario, o '' si no coincide
export function clienteParaForm(texto) {
  const t = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (!t.trim()) return ''
  const exacto = CLIENTES_FORM.find(c => c.toLowerCase() === t.trim())
  if (exacto) return exacto
  return PATRONES_CLIENTE.find(([re]) => re.test(t))?.[1] || ''
}

export function dividirEnEnvios(items) {
  const envios = []
  for (let i = 0; i < items.length; i += MAX_REPUESTOS_POR_ENVIO) {
    envios.push(items.slice(i, i + MAX_REPUESTOS_POR_ENVIO))
  }
  return envios
}

// items: [{ partNumber, cantidad, presupuesto }] (1 a 7). fecha: 'AAAA-MM-DD'.
// email: correo del técnico; el formulario lo recoge en un campo propio (parámetro «emailAddress»).
export function construirUrlFormulario({ wo, legajo, email, cliente, fecha, items }) {
  if (!items.length || items.length > MAX_REPUESTOS_POR_ENVIO) {
    throw new Error('El formulario admite de 1 a 7 repuestos por envío.')
  }
  const params = new URLSearchParams()
  params.set('usp', 'pp_url')
  if (email) params.set('emailAddress', email)
  if (wo) params.set(`entry.${CAMPO.wo}`, wo)
  if (legajo) params.set(`entry.${CAMPO.legajo}`, legajo)
  params.set(`entry.${CAMPO.zona}`, ZONA_FORM)
  if (cliente) params.set(`entry.${CAMPO.cliente}`, cliente)
  const [a, m, d] = String(fecha || '').split('-')
  if (a && m && d) {
    params.set(`entry.${CAMPO.fecha}_year`, String(Number(a)))
    params.set(`entry.${CAMPO.fecha}_month`, String(Number(m)))
    params.set(`entry.${CAMPO.fecha}_day`, String(Number(d)))
  }
  params.set(`entry.${CAMPO.cantidad}`, String(items.length).padStart(2, '0'))
  SECCIONES[items.length].forEach(([pn, cant, pres], i) => {
    const it = items[i]
    params.set(`entry.${pn}`, it.partNumber || '')
    params.set(`entry.${cant}`, String(it.cantidad ?? 1))
    if (it.presupuesto) params.set(`entry.${pres}`, it.presupuesto)
  })
  return `${FORM_BASE}?${params.toString()}`
}

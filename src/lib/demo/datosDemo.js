// Datos ficticios con los que arranca el modo demostración (nada de esto existe en Supabase).
import { DEMO_PERFIL, DEMO_USER_ID } from './modoDemo'

const uuid = () => crypto.randomUUID()

function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

const REPUESTOS = [
  ['Filtro de aire kit mantenimiento', '4450773447', 'ATM 6623 / 6627 / 6628 / 6612'],
  ['Ventosa de succión', '0090035910', 'ATM 6623 / 6627 / 6628 / 6612'],
  ['Banda de transporte', '4450741234', 'ATM 6622'],
  ['Rodillo de arrastre', '4450745678', 'ATM 6622 / 6623'],
  ['Sensor de billetes', '4450749012', 'ATM 6627'],
  ['Fuente de poder 24V', '4450753456', 'ATM 6628'],
  ['Lector de tarjetas', '4450757890', 'ATM 6612'],
  ['Impresora de recibos', '4450762345', 'ATM 6623 / 6628'],
  ['Teclado EPP', '4450766789', 'Todos los modelos'],
  ['Cerradura de bóveda', '4450771234', 'Todos los modelos'],
]

export function crearBaseDemo() {
  const ahora = new Date().toISOString()
  const hoy = hoyLima()

  const repuestos = REPUESTOS.map(([nombre, part_number, compatibility], i) => ({
    id: uuid(), nombre, part_number, descripcion: '', compatibility, created_by: null,
    created_at: new Date(Date.now() - i * 3600e3).toISOString(), updated_at: ahora,
  }))
  const rep = pn => repuestos.find(r => r.part_number === pn)

  const sitios = [
    ['6623-0101', 'AGENCIA MIRAFLORES', 'AV. LARCO 1150', 'MIRAFLORES', 'INTERBANK', '6623', 'SN0001234'],
    ['6627-0212', 'AGENCIA SAN ISIDRO', 'AV. JAVIER PRADO 2450', 'SAN ISIDRO', 'BANCO DE CREDITO DEL PERU', '6627', 'SN0002345'],
    ['6628-0323', 'AGENCIA SURCO', 'AV. CAMINOS DEL INCA 1800', 'SANTIAGO DE SURCO', 'BANCO CONTINENTAL', '6628', 'SN0003456'],
    ['6612-0434', 'AGENCIA LA MOLINA', 'AV. LA MOLINA 3200', 'LA MOLINA', 'INTERBANK', '6612', 'SN0004567'],
    ['6622-0545', 'AGENCIA JESUS MARIA', 'AV. BRASIL 1400', 'JESUS MARIA', 'BANCO DE LA NACION', '6622', 'SN0005678'],
    ['6623-0656', 'AGENCIA SAN BORJA', 'AV. AVIACION 2900', 'SAN BORJA', 'BANCO DE CREDITO DEL PERU', '6623', 'SN0006789'],
  ]
  const offsets = [0, 0, 0, 1, 2, -1]
  const horas = ['08:30:00', '10:30:00', '14:00:00', '09:00:00', '11:00:00', '15:30:00']
  const workorders = sitios.map(([codigo, site, direccion, distrito, cliente, modelo, serie], i) => ({
    id: uuid(), user_id: DEMO_USER_ID,
    anio: hoy.slice(0, 4), mes: hoy.slice(5, 7),
    cliente, serie, modelo, tipo_pm: 'PREVENTIVO', codigo_equipo: codigo, nombre_equipo: site,
    site, direccion, distrito, provincia: 'LIMA', departamento: 'LIMA', lp: '', funcion_atm: 'DISPENSADOR',
    horario_pv: '09:00 - 18:00', restricciones: '', responsable_boveda: '',
    wo: `DEMO-${String(10001 + i)}`, fecha: sumarDias(hoy, offsets[i]), hora: horas[i], hora_pv: '',
    legajo: DEMO_PERFIL.legajo, ce: DEMO_PERFIL.full_name, dni: '', created_at: ahora, updated_at: ahora,
  }))

  const almacen = [['4450773447', 6], ['0090035910', 40], ['4450741234', 2], ['4450745678', 0], ['4450749012', 1]]
  const warehouse_items = almacen.map(([part_number, quantity]) => ({
    id: uuid(), user_id: DEMO_USER_ID, part_number, quantity, created_at: ahora, updated_at: ahora,
  }))
  const warehouse_transactions = almacen.filter(([, q]) => q > 0).map(([part_number, quantity], i) => ({
    id: uuid(), user_id: DEMO_USER_ID, part_number, quantity, type: 'IN', source_type: 'WAREHOUSE',
    source_id: null, site: '', work_order: '', motivo: 'Stock inicial (demo)', created_by: DEMO_USER_ID,
    balance_after: quantity, created_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
  }))

  const lista = {
    id: uuid(), user_id: DEMO_USER_ID, name: 'Preventivo Miraflores', site: 'AGENCIA MIRAFLORES',
    work_order: workorders[0].wo, inventory_synced: false, inventory_synced_at: null,
    form_enviado_en: null, created_at: ahora, updated_at: ahora,
  }
  const spare_part_list_items = [
    { id: uuid(), list_id: lista.id, spare_part_id: rep('4450773447').id, quantity: 1, presupuesto: '', created_at: ahora },
    { id: uuid(), list_id: lista.id, spare_part_id: rep('0090035910').id, quantity: 8, presupuesto: '', created_at: ahora },
  ]

  const pedidos_personas = [
    ['Mesa de ayuda Lima', 'recepcion'], ['Central de pedidos', 'recepcion'],
    ['Motorizado Carlos R.', 'entrega'], ['Motorizado Luis P.', 'entrega'],
  ].map(([nombre, tipo]) => ({ id: uuid(), nombre, tipo, created_at: ahora }))

  const pedido = {
    id: uuid(), user_id: DEMO_USER_ID, estado: 'guardado', wo: workorders[1].wo, id_atm: workorders[1].codigo_equipo,
    site: workorders[1].site, modelo: workorders[1].modelo, direccion: workorders[1].direccion,
    recepcionado_por_id: null, recepcionado_por_nombre: '', entregado_por_id: null, entregado_por_nombre: '',
    recepcionado_at: null, created_at: ahora, updated_at: ahora,
  }
  const pedido_items = [
    { id: uuid(), pedido_id: pedido.id, spare_part_id: rep('4450749012').id, quantity: 1, created_at: ahora },
    { id: uuid(), pedido_id: pedido.id, spare_part_id: rep('4450753456').id, quantity: 1, created_at: ahora },
  ]

  return {
    profiles: [{ ...DEMO_PERFIL, clave_reiniciada_en: null }],
    repuestos,
    workorders,
    warehouse_items,
    warehouse_transactions,
    spare_part_lists: [lista],
    spare_part_list_items,
    pedidos_personas,
    pedidos: [pedido],
    pedido_items,
    preferencias_usuario: [],
    repuestos_detalle_personal: [],
  }
}

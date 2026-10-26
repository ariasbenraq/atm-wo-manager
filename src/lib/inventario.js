import { supabase } from './supabase'

// Todo movimiento de stock pasa por las funciones de Postgres de
// supabase/migrations/20261027_inventario_rpc.sql: se aplican completas o no
// se aplican y lanzan errores con un código ('STOCK_INSUFICIENTE:<pn>').

const MENSAJES = {
  NO_AUTENTICADO: () => 'Tu sesión expiró. Vuelve a iniciar sesión.',
  SIN_PERMISO: () => 'No tienes permiso para esta operación.',
  PART_NUMBER_REQUERIDO: () => 'Selecciona un repuesto.',
  TIPO_INVALIDO: () => 'Tipo de movimiento inválido.',
  CANTIDAD_INVALIDA: () => 'La cantidad no es válida.',
  MOTIVO_REQUERIDO: () => 'Indica el motivo.',
  STOCK_INSUFICIENTE: pn => `Stock insuficiente de ${pn}.`,
  STOCK_NO_CERO: () => 'Solo se puede eliminar un repuesto con stock 0. Ajusta la cantidad a 0 con Editar.',
  NO_ENCONTRADO: () => 'El repuesto ya no está en el almacén.',
  PEDIDO_NO_ENCONTRADO: () => 'El pedido ya no existe.',
  PEDIDO_YA_RECEPCIONADO: () => 'Este pedido ya fue recepcionado.',
  PEDIDO_SIN_ITEMS: () => 'El pedido no tiene repuestos.',
  REPUESTO_SIN_PN: nombres => `Estos repuestos no tienen part number en el catálogo: ${nombres}. Corrígelos antes de continuar.`,
  LISTA_NO_ENCONTRADA: () => 'La lista ya no existe.',
  LISTA_YA_SINCRONIZADA: () => 'Esta lista ya fue descontada del almacén.',
  LISTA_NO_SINCRONIZADA: () => 'Esta lista no está sincronizada.',
  LISTA_SIN_ITEMS: () => 'La lista no tiene repuestos.',
}

export function codigoErrorInventario(error) {
  return String(error?.message || '').split(':')[0]
}

export function mensajeErrorInventario(error, porDefecto = 'No se pudo actualizar el inventario.') {
  const texto = String(error?.message || '')
  const separador = texto.indexOf(':')
  const codigo = separador === -1 ? texto : texto.slice(0, separador)
  const detalle = separador === -1 ? '' : texto.slice(separador + 1)
  const mensaje = MENSAJES[codigo]
  if (mensaje) return mensaje(detalle)
  if (/fetch|network/i.test(texto)) return 'Sin conexión. El inventario solo se puede modificar en línea.'
  return texto || porDefecto
}

async function llamar(funcion, parametros) {
  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) throw error
  return data
}

export const ajustarStock = ({ partNumber, tipo, cantidad, motivo = '', wo = '', site = '' }) =>
  llamar('ajustar_stock', {
    p_part_number: partNumber, p_tipo: tipo, p_cantidad: cantidad,
    p_motivo: motivo, p_wo: wo, p_site: site,
  })

export const fijarStock = ({ partNumber, cantidad, motivo }) =>
  llamar('fijar_stock', { p_part_number: partNumber, p_cantidad: cantidad, p_motivo: motivo })

export const eliminarItemAlmacen = partNumber =>
  llamar('eliminar_item_almacen', { p_part_number: partNumber })

export const recepcionarPedido = ({ pedidoId, recepcionadoPorId = null, entregadoPorId = null }) =>
  llamar('recepcionar_pedido', {
    p_pedido_id: pedidoId,
    p_recepcionado_por_id: recepcionadoPorId,
    p_entregado_por_id: entregadoPorId,
  })

export const consumirLista = listId =>
  llamar('consumir_lista', { p_list_id: listId })

export const revertirConsumoLista = ({ listId, motivo }) =>
  llamar('revertir_consumo_lista', { p_list_id: listId, p_motivo: motivo })

// Cantidad con signo tal como afecta al stock (ADJUSTMENT ya viene con signo)
export function cantidadConSigno(tx) {
  if (tx.type === 'OUT') return -Math.abs(tx.quantity)
  if (tx.type === 'IN') return Math.abs(tx.quantity)
  return tx.quantity
}

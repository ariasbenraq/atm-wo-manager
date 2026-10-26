import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import {
  ajustarStock, fijarStock, eliminarItemAlmacen, mensajeErrorInventario, cantidadConSigno,
} from '../lib/inventario'
import {
  Input, Button, Chip,
  ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Select, SelectItem,
  Autocomplete, AutocompleteItem,
} from '@heroui/react'
import { Search, Plus, Minus, Warehouse, History, RotateCcw, Pencil, Trash2, Clock, Eye, EyeOff } from 'lucide-react'

export default function AlmacenPage() {
  const { session } = useApp()
  const userId = session?.user?.id

  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [ocultarCeros, setOcultarCeros] = useState(true)

  const [ajustando, setAjustando] = useState(false)
  const [ajustePartNumber, setAjustePartNumber] = useState('')
  const [ajusteTipo, setAjusteTipo] = useState('IN')
  const [ajusteCantidad, setAjusteCantidad] = useState('1')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [ajusteWo, setAjusteWo] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [ajusteRepuestos, setAjusteRepuestos] = useState([])
  const [ajusteRepuestosCargando, setAjusteRepuestosCargando] = useState(false)

  const [transacciones, setTransacciones] = useState([])
  const [mostrandoTransacciones, setMostrandoTransacciones] = useState(false)
  const [cargandoTransacciones, setCargandoTransacciones] = useState(false)

  const [itemEditando, setItemEditando] = useState(null)
  const [editCantidad, setEditCantidad] = useState('1')
  const [editMotivo, setEditMotivo] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const [itemEliminando, setItemEliminando] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [moviendo, setMoviendo] = useState(() => new Set())

  const [itemHistorial, setItemHistorial] = useState(null)
  const [historialTransacciones, setHistorialTransacciones] = useState([])
  const [historialListas, setHistorialListas] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const cargar = useCallback(async () => {
    if (!userId) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('user_id', userId)
        .order('part_number', { ascending: true })

      if (error) throw error

      const partNumbers = (data || []).map(i => i.part_number).filter(Boolean)
      let repuestoMap = {}
      if (partNumbers.length) {
        const { data: repuestos } = await supabase
          .from('repuestos')
          .select('nombre, part_number')
          .in('part_number', partNumbers)
        repuestoMap = new Map((repuestos || []).map(r => [r.part_number, r.nombre]))
      }

      const itemsConNombre = (data || []).map(i => ({
        ...i,
        nombre: repuestoMap.get(i.part_number) || '',
      }))
      setItems(itemsConNombre)

      await db.warehouseItems.clear()
      if (data?.length) {
        await db.warehouseItems.bulkAdd(data.map(i => ({
          idRemoto: i.id,
          userId: i.user_id,
          partNumber: i.part_number,
          nombre: repuestoMap.get(i.part_number) || '',
          quantity: i.quantity,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        })))
      }
    } catch {
      const local = await db.warehouseItems.toArray()
      setItems(local.map(i => ({
        id: i.idRemoto,
        part_number: i.partNumber,
        nombre: i.nombre || '',
        quantity: i.quantity,
        updated_at: i.updatedAt,
      })))
    } finally {
      setCargando(false)
    }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  const itemsConStock = ocultarCeros ? items.filter(i => i.quantity > 0) : items

  const filtroNormalizado = filtro.trim().toLowerCase()
  const itemsFiltrados = filtroNormalizado
    ? itemsConStock.filter(i =>
        String(i.part_number || '').toLowerCase().includes(filtroNormalizado) ||
        String(i.nombre || '').toLowerCase().includes(filtroNormalizado)
      )
    : itemsConStock

  // Refleja en pantalla y en Dexie el saldo que devolvió el servidor
  async function aplicarResultado(partNumber, quantity) {
    const ahora = new Date().toISOString()
    if (!items.some(i => i.part_number === partNumber)) {
      await cargar()
      return
    }
    setItems(prev => prev.map(i =>
      i.part_number === partNumber ? { ...i, quantity, updated_at: ahora } : i
    ))
    await db.warehouseItems.filter(i => i.partNumber === partNumber).modify({ quantity, updatedAt: ahora })
  }

  async function ajustarInventario() {
    if (!userId) return
    const cantidad = parseInt(ajusteCantidad, 10)
    if (!cantidad || cantidad < 1) return
    const partNumber = ajustePartNumber.trim()

    setGuardandoAjuste(true)
    try {
      const resultado = await ajustarStock({
        partNumber,
        tipo: ajusteTipo,
        cantidad,
        motivo: ajusteMotivo.trim(),
        wo: ajusteWo.trim(),
      })
      await aplicarResultado(resultado.part_number, resultado.quantity)

      setAjustando(false)
      setAjustePartNumber('')
      setAjusteCantidad('1')
      setAjusteMotivo('')
      setAjusteWo('')
      setMensaje({ color: 'success', texto: `Inventario actualizado: ${ajusteTipo === 'IN' ? '+' : '-'}${cantidad} ${partNumber}` })
    } catch (e) {
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e) })
    } finally {
      setGuardandoAjuste(false)
    }
  }

  async function moverUno(item, delta) {
    if (moviendo.has(item.part_number)) return
    setMoviendo(prev => new Set(prev).add(item.part_number))
    try {
      const resultado = await ajustarStock({
        partNumber: item.part_number,
        tipo: delta > 0 ? 'IN' : 'OUT',
        cantidad: 1,
      })
      await aplicarResultado(resultado.part_number, resultado.quantity)
    } catch (e) {
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e) })
    } finally {
      setMoviendo(prev => {
        const siguiente = new Set(prev)
        siguiente.delete(item.part_number)
        return siguiente
      })
    }
  }

  async function cargarTransacciones() {
    if (!userId) return
    setMostrandoTransacciones(true)
    setCargandoTransacciones(true)
    try {
      const { data, error } = await supabase
        .from('warehouse_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setTransacciones(data || [])
    } catch {
      setTransacciones([])
    } finally {
      setCargandoTransacciones(false)
    }
  }

  async function editarItem() {
    if (!itemEditando) return
    const cantidad = parseInt(editCantidad, 10)
    if (isNaN(cantidad) || cantidad < 0 || !editMotivo.trim()) return

    setGuardandoEdit(true)
    try {
      const resultado = await fijarStock({
        partNumber: itemEditando.part_number,
        cantidad,
        motivo: editMotivo.trim(),
      })
      await aplicarResultado(resultado.part_number, resultado.quantity)

      setItemEditando(null)
      setMensaje({ color: 'success', texto: `${itemEditando.nombre || itemEditando.part_number} actualizado a ${cantidad}` })
    } catch (e) {
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e, 'Error al actualizar.') })
    } finally {
      setGuardandoEdit(false)
    }
  }

  async function eliminarItem() {
    if (!itemEliminando) return
    setEliminando(true)
    try {
      await eliminarItemAlmacen(itemEliminando.part_number)

      setItems(prev => prev.filter(i => i.part_number !== itemEliminando.part_number))
      await db.warehouseItems.filter(i => i.partNumber === itemEliminando.part_number).delete()

      setItemEliminando(null)
      setMensaje({ color: 'success', texto: `${itemEliminando.nombre || itemEliminando.part_number} eliminado del almacén.` })
    } catch (e) {
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e, 'Error al eliminar.') })
    } finally {
      setEliminando(false)
    }
  }

  async function cargarHistorialItem(item) {
    setItemHistorial(item)
    setCargandoHistorial(true)
    setHistorialTransacciones([])
    setHistorialListas([])
    try {
      const { data: txs } = await supabase
        .from('warehouse_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('part_number', item.part_number)
        .order('created_at', { ascending: false })

      setHistorialTransacciones(txs || [])

      const { data: rep } = await supabase
        .from('repuestos')
        .select('id')
        .eq('part_number', item.part_number)
        .maybeSingle()

      if (rep) {
        const { data: listItems } = await supabase
          .from('spare_part_list_items')
          .select('quantity, created_at, list_id')
          .eq('spare_part_id', rep.id)

        if (listItems?.length) {
          const listIds = [...new Set(listItems.map(i => i.list_id))]
          const { data: lists } = await supabase
            .from('spare_part_lists')
            .select('id, name, site, work_order, created_at')
            .in('id', listIds)

          const listMap = new Map((lists || []).map(l => [l.id, l]))
          setHistorialListas(listItems.map(li => ({
            ...li,
            lista: listMap.get(li.list_id) || null,
          })))
        }
      }
    } catch {
      setHistorialTransacciones([])
      setHistorialListas([])
    } finally {
      setCargandoHistorial(false)
    }
  }

  function chipColor(tipo) {
    if (tipo === 'IN') return 'success'
    if (tipo === 'OUT') return 'danger'
    return 'warning'
  }

  function cantidadTexto(tx) {
    const n = cantidadConSigno(tx)
    return n > 0 ? `+${n}` : String(n)
  }

  function fechaCorta(fecha) {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-5">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Almacén"
          description={mensaje.texto}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
            <Warehouse size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-default-900">Almacén</h1>
            <p className="text-sm text-default-500">
              {itemsFiltrados.length} repuesto{itemsFiltrados.length === 1 ? '' : 's'}
              {ocultarCeros && items.length !== itemsFiltrados.length ? ` de ${items.length}` : ''} en inventario
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="flat"
            radius="lg"
            size="sm"
            startContent={<History size={14} />}
            onPress={cargarTransacciones}
          >
            Historial
          </Button>
          <Button
            color="primary"
            radius="lg"
            size="sm"
            startContent={<Plus size={14} />}
            onPress={() => {
              setAjustePartNumber('')
              setAjusteTipo('IN')
              setAjusteCantidad('1')
              setAjusteMotivo('')
              setAjusteWo('')
              setAjusteRepuestos([])
              setAjusteRepuestosCargando(true)
              setAjustando(true)
              supabase.from('repuestos').select('id, nombre, part_number').order('nombre').then(({ data }) => {
                setAjusteRepuestos(data || [])
                setAjusteRepuestosCargando(false)
              })
            }}
          >
            Ajustar inventario
          </Button>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Buscar por part number..."
          startContent={<Search size={16} className="text-default-400" />}
          value={filtro}
          onValueChange={setFiltro}
          variant="bordered"
          radius="lg"
          size="sm"
          className="flex-1"
        />
        <Button
          size="sm"
          variant="flat"
          radius="lg"
          startContent={ocultarCeros ? <Eye size={14} /> : <EyeOff size={14} />}
          onPress={() => setOcultarCeros(prev => !prev)}
          className="shrink-0"
        >
          {ocultarCeros ? 'Solo con stock' : 'Mostrar todos'}
        </Button>
      </div>

      {cargando ? (
        <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
          Cargando inventario...
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="rounded-xl border border-default-200 bg-white px-5 py-6 text-sm text-default-400 flex flex-col items-center gap-3">
          <RotateCcw size={24} className="text-default-300" />
          <span>{filtro ? 'No se encontraron repuestos.' : ocultarCeros && items.length > 0 ? 'Todos los repuestos están en cero.' : 'El almacén está vacío. Agrega repuestos usando "Ajustar inventario".'}</span>
        </div>
      ) : (
        <>
          <div className="block md:hidden space-y-2">
            {itemsFiltrados.map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-default-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-default-900 truncate">
                      {item.nombre || item.part_number}
                    </p>
                    {item.nombre && (
                      <p className="text-[12px] font-mono text-default-400 truncate mt-0.5">
                        {item.part_number}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[17px] font-bold text-default-800 tabular-nums shrink-0">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-default-100">
                  <div className="flex gap-1">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="lg"
                      className="min-w-8 h-8 text-default-400 hover:text-primary"
                      onPress={() => { setItemEditando(item); setEditCantidad(String(item.quantity)); setEditMotivo('') }}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="lg"
                      className="min-w-8 h-8 text-default-400 hover:text-default-600"
                      onPress={() => cargarHistorialItem(item)}
                    >
                      <Clock size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="lg"
                      isDisabled={item.quantity > 0}
                      className="min-w-8 h-8 text-default-400 hover:text-danger"
                      onPress={() => setItemEliminando(item)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="lg"
                      className="min-w-8 h-8 text-default-400 hover:text-danger"
                      isDisabled={item.quantity <= 0 || moviendo.has(item.part_number)}
                      onPress={() => moverUno(item, -1)}
                    >
                      <Minus size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="lg"
                      isDisabled={moviendo.has(item.part_number)}
                      className="min-w-8 h-8 text-default-400 hover:text-primary"
                      onPress={() => moverUno(item, 1)}
                    >
                      <Plus size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-default-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400 items-center">
              <span>Repuesto</span>
              <span className="text-center">Cantidad</span>
              <span className="text-center">Ajustar</span>
              <span className="text-center">Acciones</span>
            </div>
            <ScrollShadow className="max-h-[55vh]">
              <div className="divide-y divide-default-100/80">
                {itemsFiltrados.map(item => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 items-center transition-colors hover:bg-default-50/60"
                  >
                    <div className="flex items-center min-w-0 gap-2">
                      <p className="truncate text-[14px] font-medium text-default-900">
                        {item.nombre || item.part_number}
                      </p>
                      {item.nombre && (
                        <span className="shrink-0 font-mono text-[12px] text-default-400">
                          {item.part_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="font-mono text-[15px] font-semibold text-default-700 tabular-nums">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-7 h-7 text-default-400 hover:text-danger"
                        isDisabled={item.quantity <= 0 || moviendo.has(item.part_number)}
                        onPress={() => moverUno(item, -1)}
                      >
                        <Minus size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        isDisabled={moviendo.has(item.part_number)}
                        className="min-w-7 h-7 text-default-400 hover:text-primary"
                        onPress={() => moverUno(item, 1)}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-7 h-7 text-default-400 hover:text-primary"
                        onPress={() => { setItemEditando(item); setEditCantidad(String(item.quantity)); setEditMotivo('') }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-7 h-7 text-default-400 hover:text-default-600"
                        onPress={() => cargarHistorialItem(item)}
                      >
                        <Clock size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        isDisabled={item.quantity > 0}
                        className="min-w-7 h-7 text-default-400 hover:text-danger"
                        onPress={() => setItemEliminando(item)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollShadow>
          </div>
        </>
      )}

      <Modal isOpen={ajustando} onOpenChange={abierto => !abierto && setAjustando(false)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Ajustar inventario</ModalHeader>
            <ModalBody className="space-y-4">
              <Autocomplete
                label="Part Number"
                placeholder="Buscar por nombre o part number..."
                defaultItems={ajusteRepuestos}
                selectedKey={ajustePartNumber}
                onSelectionChange={key => setAjustePartNumber(key)}
                variant="bordered"
                radius="lg"
                isLoading={ajusteRepuestosCargando}
                isDisabled={ajusteRepuestosCargando}
                autoFocus
              >
                {r => (
                  <AutocompleteItem key={r.part_number} textValue={`${r.nombre} ${r.part_number}`}>
                    <span>{r.nombre}</span>
                    <span className="text-default-400 ml-2 font-mono text-xs">{r.part_number}</span>
                  </AutocompleteItem>
                )}
              </Autocomplete>
              <Select
                label="Tipo"
                selectedKeys={[ajusteTipo]}
                onSelectionChange={keys => setAjusteTipo(Array.from(keys)[0] || 'IN')}
                variant="bordered"
                radius="lg"
              >
                <SelectItem key="IN">Ingreso (IN)</SelectItem>
                <SelectItem key="OUT">Salida (OUT)</SelectItem>
              </Select>
              <Input
                label="Cantidad"
                type="text"
                inputMode="numeric"
                value={ajusteCantidad}
                onValueChange={setAjusteCantidad}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="WO (opcional)"
                value={ajusteWo}
                onValueChange={setAjusteWo}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Motivo (opcional)"
                placeholder="Ej.: devolución, préstamo a otro CE"
                value={ajusteMotivo}
                onValueChange={setAjusteMotivo}
                variant="bordered"
                radius="lg"
              />
              <p className="text-xs text-default-400">
                Para corregir la cantidad por un conteo físico usa Editar en el repuesto.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setAjustando(false)}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={ajustarInventario}
                isDisabled={guardandoAjuste || !ajustePartNumber.trim() || !parseInt(ajusteCantidad, 10)}
                isLoading={guardandoAjuste}
              >
                Guardar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={mostrandoTransacciones} onOpenChange={abierto => !abierto && setMostrandoTransacciones(false)} size="2xl">
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Historial de transacciones</ModalHeader>
            <ModalBody>
              {cargandoTransacciones ? (
                <p className="text-sm text-default-400">Cargando...</p>
              ) : transacciones.length === 0 ? (
                <p className="text-sm text-default-500">No hay transacciones registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400 items-center min-w-[450px]">
                    <span>Part Number</span>
                    <span className="text-center">Tipo</span>
                    <span className="text-center">Cantidad</span>
                    <span className="text-right">Fecha</span>
                  </div>
                  <div className="divide-y divide-default-100 max-h-[50vh] overflow-y-auto">
                    {transacciones.map(tx => (
                      <div key={tx.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center min-w-[450px]">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-default-900 truncate">{tx.part_number}</p>
                          {(tx.work_order || tx.motivo) && (
                            <p className="text-[11px] text-default-400 truncate">
                              {[tx.work_order, tx.motivo].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <Chip
                          color={chipColor(tx.type)}
                          variant="flat"
                          size="sm"
                          radius="lg"
                          className="justify-self-center"
                        >
                          {tx.type}
                        </Chip>
                        <span className="font-mono text-sm text-default-700 tabular-nums text-center">
                          {cantidadTexto(tx)}
                        </span>
                        <span className="text-xs text-default-400 text-right">
                          {fechaCorta(tx.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setMostrandoTransacciones(false)}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(itemEditando)} onOpenChange={abierto => !abierto && setItemEditando(null)} size="md">
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Editar cantidad</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">Repuesto</p>
                <p className="mt-1 text-sm font-semibold text-default-800">{itemEditando?.nombre || itemEditando?.part_number}</p>
                {itemEditando?.nombre && (
                  <p className="mt-0.5 font-mono text-xs text-default-400">{itemEditando?.part_number}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  radius="lg"
                  className="text-default-500"
                  isDisabled={parseInt(editCantidad, 10) <= 0}
                  onPress={() => setEditCantidad(String(Math.max(0, parseInt(editCantidad, 10) - 1)))}
                >
                  <Minus size={16} />
                </Button>
                <Input
                  label="Cantidad"
                  type="text"
                  inputMode="numeric"
                  value={editCantidad}
                  onValueChange={v => { if (/^\d*$/.test(v)) setEditCantidad(v) }}
                  variant="bordered"
                  radius="lg"
                  className="flex-1"
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  radius="lg"
                  className="text-default-500"
                  onPress={() => setEditCantidad(String(parseInt(editCantidad, 10) + 1))}
                >
                  <Plus size={16} />
                </Button>
              </div>
              <Input
                label="Motivo"
                placeholder="Ej.: conteo físico"
                value={editMotivo}
                onValueChange={setEditMotivo}
                variant="bordered"
                radius="lg"
                isRequired
              />
              <p className="text-xs text-default-400">
                Se registra como ajuste en el historial.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setItemEditando(null)}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={editarItem}
                isDisabled={guardandoEdit || editCantidad === '' || parseInt(editCantidad, 10) < 0 || !editMotivo.trim()}
                isLoading={guardandoEdit}
              >
                Guardar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(itemEliminando)} onOpenChange={abierto => !abierto && setItemEliminando(null)} size="sm">
        <ModalContent>
          <>
            <ModalHeader className="text-danger">Eliminar del almacén</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Eliminar <span className="font-semibold">{itemEliminando?.nombre || itemEliminando?.part_number}</span> del almacén? Su historial de movimientos se conserva.
              </p>
              {itemEliminando?.nombre && (
                <p className="font-mono text-xs text-default-400">{itemEliminando?.part_number}</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setItemEliminando(null)}>
                Cancelar
              </Button>
              <Button
                color="danger"
                onPress={eliminarItem}
                isLoading={eliminando}
              >
                Eliminar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(itemHistorial)} onOpenChange={abierto => !abierto && setItemHistorial(null)} size="2xl">
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Historial del repuesto</ModalHeader>
            <ModalBody className="space-y-5">
              <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">Repuesto</p>
                <p className="mt-1 text-sm font-semibold text-default-800">{itemHistorial?.nombre || itemHistorial?.part_number}</p>
                {itemHistorial?.nombre && (
                  <p className="mt-0.5 font-mono text-xs text-default-400">{itemHistorial?.part_number}</p>
                )}
              </div>

              {cargandoHistorial ? (
                <p className="text-sm text-default-400">Cargando historial...</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-default-700 mb-2">Movimientos de almacén</h3>
                    {historialTransacciones.length === 0 ? (
                      <p className="text-xs text-default-400">Sin movimientos registrados.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-default-200">
                        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 border-b border-default-100 bg-default-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-default-400 items-center min-w-[480px]">
                          <span>Tipo</span>
                          <span>Cantidad</span>
                          <span>Work Order</span>
                          <span className="text-right">Fecha</span>
                        </div>
                        <div className="divide-y divide-default-100 max-h-[25vh] overflow-y-auto">
                          {historialTransacciones.map(tx => (
                            <div key={tx.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 items-center min-w-[480px]">
                              <Chip color={chipColor(tx.type)} variant="flat" size="sm" radius="lg">
                                {tx.type}
                              </Chip>
                              <span className="font-mono text-sm text-default-700 tabular-nums">
                                {cantidadTexto(tx)}
                                {tx.balance_after != null && (
                                  <span className="ml-1 text-[11px] text-default-400">→ {tx.balance_after}</span>
                                )}
                              </span>
                              <span className="text-xs text-default-500">
                                {tx.work_order || '-'}
                                {tx.site ? ` · ${tx.site}` : ''}
                                {tx.motivo && <span className="block text-[11px] text-default-400">{tx.motivo}</span>}
                              </span>
                              <span className="text-xs text-default-400 text-right whitespace-nowrap">
                                {fechaCorta(tx.created_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-default-700 mb-2">Uso en listas de repuestos</h3>
                    {historialListas.length === 0 ? (
                      <p className="text-xs text-default-400">Este repuesto no ha sido agregado a ninguna lista.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-default-200">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-default-400 items-center min-w-[500px]">
                          <span>Lista</span>
                          <span>Work Order</span>
                          <span>Cant.</span>
                          <span className="text-right">Fecha</span>
                        </div>
                        <div className="divide-y divide-default-100 max-h-[25vh] overflow-y-auto">
                          {historialListas.map((uso, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center min-w-[500px]">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-default-900 truncate">{uso.lista?.name || '-'}</p>
                                {uso.lista?.site && (
                                  <p className="text-[11px] text-default-400 truncate">{uso.lista.site}</p>
                                )}
                              </div>
                              <span className="text-xs text-default-500 font-mono">
                                {uso.lista?.work_order || '-'}
                              </span>
                              <span className="font-mono text-sm text-default-700 tabular-nums text-center">
                                {uso.quantity}
                              </span>
                              <span className="text-xs text-default-400 text-right whitespace-nowrap">
                                {fechaCorta(uso.lista?.created_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setItemHistorial(null)}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

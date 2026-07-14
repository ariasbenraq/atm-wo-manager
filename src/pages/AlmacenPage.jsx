import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import {
  Input, Button, Chip,
  ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Select, SelectItem,
  Autocomplete, AutocompleteItem,
} from '@heroui/react'
import { Search, Plus, Minus, Warehouse, History, RotateCcw } from 'lucide-react'

export default function AlmacenPage() {
  const { session } = useApp()
  const userId = session?.user?.id

  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const [ajustando, setAjustando] = useState(false)
  const [ajustePartNumber, setAjustePartNumber] = useState('')
  const [ajusteTipo, setAjusteTipo] = useState('IN')
  const [ajusteCantidad, setAjusteCantidad] = useState('1')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [ajusteRepuestos, setAjusteRepuestos] = useState([])
  const [ajusteRepuestosCargando, setAjusteRepuestosCargando] = useState(false)

  const [transacciones, setTransacciones] = useState([])
  const [mostrandoTransacciones, setMostrandoTransacciones] = useState(false)
  const [cargandoTransacciones, setCargandoTransacciones] = useState(false)

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

  const filtroNormalizado = filtro.trim().toLowerCase()
  const itemsFiltrados = filtroNormalizado
    ? items.filter(i =>
        String(i.part_number || '').toLowerCase().includes(filtroNormalizado) ||
        String(i.nombre || '').toLowerCase().includes(filtroNormalizado)
      )
    : items

  async function ajustarInventario() {
    if (!userId) return
    const cantidad = parseInt(ajusteCantidad, 10)
    if (!cantidad || cantidad < 1) return

    setGuardandoAjuste(true)
    try {
      const delta = ajusteTipo === 'OUT' ? -cantidad : cantidad

      const { data: existing } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('user_id', userId)
        .eq('part_number', ajustePartNumber.trim())
        .maybeSingle()

      if (existing) {
        const nuevaCantidad = Math.max(0, existing.quantity + delta)
        const { error } = await supabase
          .from('warehouse_items')
          .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
          .eq('id', existing.id)

        if (error) throw error

        setItems(prev => prev.map(i =>
          i.id === existing.id ? { ...i, quantity: nuevaCantidad, updated_at: new Date().toISOString() } : i
        ))

        await db.warehouseItems.filter(i => i.idRemoto === existing.id).modify({ quantity: nuevaCantidad })
      } else {
        if (ajusteTipo === 'OUT') {
          setMensaje({ color: 'warning', texto: 'No puedes retirar un repuesto que no está en el almacén.' })
          return
        }
        const { data, error } = await supabase
          .from('warehouse_items')
          .insert({ user_id: userId, part_number: ajustePartNumber.trim(), quantity: cantidad })
          .select('*')
          .single()

        if (error) throw error

        setItems(prev => [...prev, data])

        await db.warehouseItems.add({
          idRemoto: data.id,
          userId: data.user_id,
          partNumber: data.part_number,
          quantity: data.quantity,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        })
      }

      await supabase
        .from('warehouse_transactions')
        .insert({
          user_id: userId,
          part_number: ajustePartNumber.trim(),
          quantity: cantidad,
          type: ajusteTipo,
          source_type: 'WAREHOUSE',
        })

      setAjustando(false)
      setAjustePartNumber('')
      setAjusteCantidad('1')
      setMensaje({ color: 'success', texto: `Inventario actualizado: ${ajusteTipo === 'IN' ? '+' : '-'}${cantidad} ${ajustePartNumber.trim()}` })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'Error al ajustar inventario.' })
    } finally {
      setGuardandoAjuste(false)
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

  function chipColor(tipo) {
    if (tipo === 'IN') return 'success'
    if (tipo === 'OUT') return 'danger'
    return 'warning'
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
              {items.length} repuesto{items.length === 1 ? '' : 's'} en inventario
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

      <Input
        placeholder="Buscar por part number..."
        startContent={<Search size={16} className="text-default-400" />}
        value={filtro}
        onValueChange={setFiltro}
        variant="bordered"
        radius="lg"
        size="sm"
      />

      {cargando ? (
        <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
          Cargando inventario...
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="rounded-xl border border-default-200 bg-white px-5 py-6 text-sm text-default-400 flex flex-col items-center gap-3">
          <RotateCcw size={24} className="text-default-300" />
          <span>{filtro ? 'No se encontraron repuestos.' : 'El almacén está vacío. Agrega repuestos usando "Ajustar inventario".'}</span>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
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
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-default-100">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="lg"
                    className="min-w-8 h-8 text-default-400 hover:text-danger"
                    isDisabled={item.quantity <= 0}
                    onPress={async () => {
                      const nuevaCantidad = Math.max(0, item.quantity - 1)
                      const { error } = await supabase
                        .from('warehouse_items')
                        .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
                        .eq('id', item.id)
                      if (!error) {
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: nuevaCantidad } : i))
                        await db.warehouseItems.filter(i => i.idRemoto === item.id).modify({ quantity: nuevaCantidad })
                        await supabase.from('warehouse_transactions').insert({
                          user_id: userId, part_number: item.part_number, quantity: 1, type: 'OUT', source_type: 'WAREHOUSE',
                        })
                      }
                    }}
                  >
                    <Minus size={15} />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="lg"
                    className="min-w-8 h-8 text-default-400 hover:text-primary"
                    onPress={async () => {
                      const nuevaCantidad = item.quantity + 1
                      const { error } = await supabase
                        .from('warehouse_items')
                        .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
                        .eq('id', item.id)
                      if (!error) {
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: nuevaCantidad } : i))
                        await db.warehouseItems.filter(i => i.idRemoto === item.id).modify({ quantity: nuevaCantidad })
                        await supabase.from('warehouse_transactions').insert({
                          user_id: userId, part_number: item.part_number, quantity: 1, type: 'IN', source_type: 'WAREHOUSE',
                        })
                      }
                    }}
                  >
                    <Plus size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table layout */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-default-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-default-100 bg-default-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400 items-center">
              <span>Repuesto</span>
              <span className="text-center">Cantidad</span>
              <span className="text-center">Ajustar</span>
            </div>
            <ScrollShadow className="max-h-[55vh]">
              <div className="divide-y divide-default-100/80">
                {itemsFiltrados.map(item => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 items-center transition-colors hover:bg-default-50/60"
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
                        isDisabled={item.quantity <= 0}
                        onPress={async () => {
                          const nuevaCantidad = Math.max(0, item.quantity - 1)
                          const { error } = await supabase
                            .from('warehouse_items')
                            .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
                            .eq('id', item.id)
                          if (!error) {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: nuevaCantidad } : i))
                            await db.warehouseItems.filter(i => i.idRemoto === item.id).modify({ quantity: nuevaCantidad })
                            await supabase.from('warehouse_transactions').insert({
                              user_id: userId, part_number: item.part_number, quantity: 1, type: 'OUT', source_type: 'WAREHOUSE',
                            })
                          }
                        }}
                      >
                        <Minus size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-7 h-7 text-default-400 hover:text-primary"
                        onPress={async () => {
                          const nuevaCantidad = item.quantity + 1
                          const { error } = await supabase
                            .from('warehouse_items')
                            .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
                            .eq('id', item.id)
                          if (!error) {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: nuevaCantidad } : i))
                            await db.warehouseItems.filter(i => i.idRemoto === item.id).modify({ quantity: nuevaCantidad })
                            await supabase.from('warehouse_transactions').insert({
                              user_id: userId, part_number: item.part_number, quantity: 1, type: 'IN', source_type: 'WAREHOUSE',
                            })
                          }
                        }}
                      >
                        <Plus size={14} />
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
                <SelectItem key="ADJUSTMENT">Ajuste manual</SelectItem>
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
                        <span className="text-sm font-medium text-default-900 truncate">{tx.part_number}</span>
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
                          {tx.type === 'OUT' ? '-' : '+'}{tx.quantity}
                        </span>
                        <span className="text-xs text-default-400 text-right">
                          {new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
    </div>
  )
}

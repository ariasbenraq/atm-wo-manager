import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useIsAdmin } from '../hooks/usePermissions'
import { formatearFecha, formatearFechaHora } from '../lib/date'
import PersonasPedidos from '../components/pedidos/PersonasPedidos'
import {
  Card, CardBody, CardHeader, Divider,
  Input, Button, Chip, Tabs, Tab,
  Autocomplete, AutocompleteItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import {
  ShoppingCart, Plus, Trash2, X, Check, Package, ClipboardCheck, ChevronRight,
} from 'lucide-react'

function agruparItemsPorPedido(items) {
  const porPedido = new Map()
  for (const item of items || []) {
    const lista = porPedido.get(item.pedido_id) || []
    lista.push(item)
    porPedido.set(item.pedido_id, lista)
  }
  return porPedido
}

function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

// 0 = hoy, 1 = días posteriores, 2 = días anteriores o sin fecha
function rangoFecha(fecha, hoy) {
  if (!fecha) return 2
  if (fecha === hoy) return 0
  return fecha > hoy ? 1 : 2
}

// Hoy primero, luego días posteriores (ascendente) y al final los anteriores (más reciente primero).
// Una WO reprogramada aparece una sola vez, con su fecha más relevante.
function ordenarWosCatalogo(lista) {
  const hoy = hoyLima()
  const ordenadas = [...lista].sort((a, b) => {
    const ra = rangoFecha(a.fecha, hoy)
    const rb = rangoFecha(b.fecha, hoy)
    if (ra !== rb) return ra - rb
    const cmp = String(a.fecha || '').localeCompare(String(b.fecha || ''))
    return ra === 2 ? -cmp : cmp
  })
  const vistas = new Set()
  const unicas = []
  for (const w of ordenadas) {
    const wo = String(w.wo || '').trim()
    if (!wo || vistas.has(wo)) continue
    vistas.add(wo)
    unicas.push({ ...w, wo })
  }
  return unicas
}

export default function PedidosPage() {
  const { session } = useApp()
  const userId = session?.user?.id
  const esAdmin = useIsAdmin()

  const [pestana, setPestana] = useState('pedidos')
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [repuestos, setRepuestos] = useState([])
  const [wosCatalogo, setWosCatalogo] = useState([])
  const [personas, setPersonas] = useState([])

  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [woCatalogoKey, setWoCatalogoKey] = useState(null)
  const [formWo, setFormWo] = useState('')
  const [formIdAtm, setFormIdAtm] = useState('')
  const [formSite, setFormSite] = useState('')
  const [formModelo, setFormModelo] = useState('')
  const [formDireccion, setFormDireccion] = useState('')
  const [itemsForm, setItemsForm] = useState([])
  const [itemRepuestoId, setItemRepuestoId] = useState('')
  const [itemCantidadStr, setItemCantidadStr] = useState('1')
  const [guardandoPedido, setGuardandoPedido] = useState(false)
  const [catalogosCargando, setCatalogosCargando] = useState(false)

  const [recepcionAbierta, setRecepcionAbierta] = useState(false)
  const [pedidoRecepcion, setPedidoRecepcion] = useState(null)
  const [recepcionPorId, setRecepcionPorId] = useState('ninguno')
  const [entregaPorId, setEntregaPorId] = useState('ninguno')
  const [confirmandoRecepcion, setConfirmandoRecepcion] = useState(false)
  const [errorRecepcion, setErrorRecepcion] = useState(null)

  const [pedidoDetalle, setPedidoDetalle] = useState(null)

  const [eliminando, setEliminando] = useState(null)
  const [eliminandoConfirmado, setEliminandoConfirmado] = useState(false)

  const cargarPedidos = useCallback(async () => {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      let itemsRemotos = []
      const { data: itemsData, error: errItems } = await supabase
        .from('pedido_items')
        .select('*, repuestos(nombre, part_number)')

      if (!errItems) itemsRemotos = itemsData || []

      const porPedido = agruparItemsPorPedido(itemsRemotos)
      const pedidosConItems = (data || []).map(p => ({
        ...p,
        items: (porPedido.get(p.id) || []).map(i => ({
          id: i.id,
          spare_part_id: i.spare_part_id,
          quantity: i.quantity,
          repuesto: i.repuestos || null,
        })),
      }))

      setPedidos(pedidosConItems)

      await db.pedidos.clear()
      await db.pedidoItems.clear()
      if (pedidosConItems.length) {
        await db.pedidos.bulkAdd(pedidosConItems.map(p => ({
          idRemoto: p.id,
          userId: p.user_id,
          estado: p.estado,
          wo: p.wo || '',
          idAtm: p.id_atm || '',
          site: p.site || '',
          modelo: p.modelo || '',
          direccion: p.direccion || '',
          recepcionadoPorNombre: p.recepcionado_por_nombre || '',
          entregadoPorNombre: p.entregado_por_nombre || '',
          recepcionadoAt: p.recepcionado_at || null,
          creadoEn: p.created_at,
        })))
        const itemsPlanos = pedidosConItems.flatMap(p =>
          p.items.map(i => ({
            idRemoto: i.id,
            pedidoId: p.id,
            sparePartId: i.spare_part_id,
            quantity: i.quantity,
          }))
        )
        if (itemsPlanos.length) await db.pedidoItems.bulkAdd(itemsPlanos)
      }
    } catch {
      try {
        const locales = await db.pedidos.orderBy('localId').reverse().toArray()
        const itemsLocales = await db.pedidoItems.toArray()
        const porPedido = new Map()
        for (const i of itemsLocales) {
          const lista = porPedido.get(i.pedidoId) || []
          lista.push({
            id: i.idRemoto,
            spare_part_id: i.sparePartId,
            quantity: i.quantity,
            repuesto: null,
          })
          porPedido.set(i.pedidoId, lista)
        }
        setPedidos(locales.map(p => ({
          id: p.idRemoto,
          user_id: p.userId,
          estado: p.estado,
          wo: p.wo || '',
          id_atm: p.idAtm || '',
          site: p.site || '',
          modelo: p.modelo || '',
          direccion: p.direccion || '',
          recepcionado_por_nombre: p.recepcionadoPorNombre || '',
          entregado_por_nombre: p.entregadoPorNombre || '',
          recepcionado_at: p.recepcionadoAt || null,
          items: porPedido.get(p.idRemoto) || [],
        })))
        setMensaje({ color: 'warning', texto: 'Sin conexión. Mostrando los pedidos locales.' })
      } catch { /* silent */ }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarPedidos() }, [cargarPedidos])

  async function cargarCatalogosNuevo() {
    setCatalogosCargando(true)
    try {
      const [repRes, woRes] = await Promise.all([
        supabase.from('repuestos').select('id, nombre, part_number').order('nombre'),
        supabase
          .from('workorders')
          .select('wo, codigo_equipo, nombre_equipo, modelo, site, direccion, serie, distrito, fecha'),
      ])
      if (repRes.data) setRepuestos(repRes.data)
      if (woRes.data) setWosCatalogo(ordenarWosCatalogo(woRes.data))
      if (repRes.error || woRes.error) throw new Error('parcial')
    } catch {
      if (!repuestos.length) {
        const local = await db.repuestos.toArray()
        setRepuestos(local.map(r => ({
          id: r.idRemoto || r.localId,
          nombre: r.nombre,
          part_number: r.partNumber,
        })))
      }
      if (!wosCatalogo.length) {
        const local = await db.workorders.toArray()
        setWosCatalogo(ordenarWosCatalogo(local.map(w => ({
          wo: w.wo,
          codigo_equipo: w.codigoEquipo || '',
          nombre_equipo: w.nombreEquipo || '',
          modelo: w.modelo || '',
          site: w.site || '',
          direccion: w.direccion || '',
          serie: w.serie || '',
          distrito: w.distrito || '',
          fecha: w.fecha || '',
        }))))
      }
    } finally {
      setCatalogosCargando(false)
    }
  }

  async function cargarPersonas() {
    try {
      const { data, error } = await supabase
        .from('pedidos_personas')
        .select('*')
        .order('nombre')
      if (error) throw error
      setPersonas(data || [])
    } catch {
      const local = await db.pedidosPersonas.toArray()
      setPersonas(local.map(p => ({ id: p.idRemoto, nombre: p.nombre, tipo: p.tipo })))
    }
  }

  function abrirNuevo() {
    setWoCatalogoKey(null)
    setFormWo('')
    setFormIdAtm('')
    setFormSite('')
    setFormModelo('')
    setFormDireccion('')
    setItemsForm([])
    setItemRepuestoId('')
    setItemCantidadStr('1')
    setGuardandoPedido(false)
    setNuevoAbierto(true)
    cargarCatalogosNuevo()
  }

  function seleccionarWoCatalogo(woKey) {
    setWoCatalogoKey(woKey)
    const wo = wosCatalogo.find(w => w.wo === woKey)
    if (!wo) return
    setFormWo(wo.wo || '')
    setFormIdAtm(wo.codigo_equipo || '')
    setFormSite(wo.nombre_equipo || '')
    setFormModelo(wo.modelo || '')
    setFormDireccion(wo.direccion || '')
  }

  function agregarItemForm() {
    if (!itemRepuestoId) return
    const repuesto = repuestos.find(r => r.id === itemRepuestoId)
    if (!repuesto) return
    const cantidad = Math.max(1, parseInt(itemCantidadStr, 10) || 1)

    const existente = itemsForm.find(i => i.spare_part_id === itemRepuestoId)
    if (existente) {
      setItemsForm(prev => prev.map(i =>
        i.spare_part_id === itemRepuestoId ? { ...i, quantity: i.quantity + cantidad } : i
      ))
    } else {
      setItemsForm(prev => [...prev, {
        spare_part_id: repuesto.id,
        nombre: repuesto.nombre,
        part_number: repuesto.part_number,
        quantity: cantidad,
      }])
    }
    setItemRepuestoId('')
    setItemCantidadStr('1')
  }

  function quitarItemForm(sparePartId) {
    setItemsForm(prev => prev.filter(i => i.spare_part_id !== sparePartId))
  }

  async function guardarPedido() {
    if (!userId) return
    if (!itemsForm.length) {
      setMensaje({ color: 'warning', texto: 'Agrega al menos un repuesto al pedido.' })
      return
    }

    setGuardandoPedido(true)
    try {
      const { data: pedido, error } = await supabase
        .from('pedidos')
        .insert({
          user_id: userId,
          estado: 'guardado',
          wo: formWo.trim(),
          id_atm: formIdAtm.trim(),
          site: formSite.trim(),
          modelo: formModelo.trim(),
          direccion: formDireccion.trim(),
        })
        .select('*')
        .single()

      if (error) throw error

      const itemsPayload = itemsForm.map(i => ({
        pedido_id: pedido.id,
        spare_part_id: i.spare_part_id,
        quantity: i.quantity,
      }))

      const { data: itemsCreados, error: errItems } = await supabase
        .from('pedido_items')
        .insert(itemsPayload)
        .select('*')

      if (errItems) {
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        throw errItems
      }

      const nuevoPedido = {
        ...pedido,
        items: (itemsCreados || []).map(i => {
          const form = itemsForm.find(f => f.spare_part_id === i.spare_part_id)
          return {
            id: i.id,
            spare_part_id: i.spare_part_id,
            quantity: i.quantity,
            repuesto: form ? { nombre: form.nombre, part_number: form.part_number } : null,
          }
        }),
      }
      setPedidos(prev => [nuevoPedido, ...prev])

      await db.pedidos.add({
        idRemoto: pedido.id,
        userId,
        estado: 'guardado',
        wo: pedido.wo || '',
        idAtm: pedido.id_atm || '',
        site: pedido.site || '',
        modelo: pedido.modelo || '',
        direccion: pedido.direccion || '',
        recepcionadoPorNombre: '',
        entregadoPorNombre: '',
        recepcionadoAt: null,
        creadoEn: pedido.created_at,
      })
      await db.pedidoItems.bulkAdd((itemsCreados || []).map(i => ({
        idRemoto: i.id,
        pedidoId: pedido.id,
        sparePartId: i.spare_part_id,
        quantity: i.quantity,
      })))

      setNuevoAbierto(false)
      setMensaje({ color: 'success', texto: 'Pedido guardado.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudo guardar el pedido.' })
    } finally {
      setGuardandoPedido(false)
    }
  }

  async function eliminarPedido() {
    if (!eliminando) return
    setEliminandoConfirmado(true)
    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', eliminando.id)

      if (error) throw error

      setPedidos(prev => prev.filter(p => p.id !== eliminando.id))

      try {
        await db.pedidos.filter(p => p.idRemoto === eliminando.id).delete()
        await db.pedidoItems.filter(i => i.pedidoId === eliminando.id).delete()
      } catch { /* silent */ }

      setMensaje({ color: 'success', texto: 'Pedido eliminado.' })
      setEliminando(null)
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudo eliminar el pedido.' })
    } finally {
      setEliminandoConfirmado(false)
    }
  }

  function abrirRecepcion(pedido) {
    setPedidoRecepcion(pedido)
    setRecepcionPorId('ninguno')
    setEntregaPorId('ninguno')
    setErrorRecepcion(null)
    setRecepcionAbierta(true)
    cargarPersonas()
  }

  async function confirmarRecepcion() {
    const pedido = pedidoRecepcion
    if (!pedido?.items?.length) {
      setErrorRecepcion('El pedido no tiene items.')
      return
    }

    const ahora = new Date().toISOString()
    const personaRec = personas.find(p => p.id === recepcionPorId) || null
    const personaEnt = personas.find(p => p.id === entregaPorId) || null
    const ownerUserId = pedido.user_id || userId

    setConfirmandoRecepcion(true)
    setErrorRecepcion(null)

    try {
      // 1. Pasar todo el pedido al inventario personal (almacén)
      for (const item of pedido.items) {
        const pn = item.repuesto?.part_number
        if (!pn) continue

        const { data: existing } = await supabase
          .from('warehouse_items')
          .select('*')
          .eq('user_id', ownerUserId)
          .eq('part_number', pn)
          .maybeSingle()

        if (existing) {
          const nuevaCantidad = existing.quantity + (item.quantity ?? 1)
          const { error } = await supabase
            .from('warehouse_items')
            .update({ quantity: nuevaCantidad, updated_at: ahora })
            .eq('id', existing.id)
          if (error) throw error

          await db.warehouseItems.filter(i => i.idRemoto === existing.id).modify({ quantity: nuevaCantidad })
        } else {
          const { data: nuevo, error } = await supabase
            .from('warehouse_items')
            .insert({ user_id: ownerUserId, part_number: pn, quantity: item.quantity ?? 1 })
            .select('*')
            .single()
          if (error) throw error

          await db.warehouseItems.add({
            idRemoto: nuevo.id,
            userId: ownerUserId,
            partNumber: pn,
            nombre: item.repuesto?.nombre || '',
            quantity: item.quantity ?? 1,
            createdAt: nuevo.created_at,
            updatedAt: ahora,
          })
        }

        const { error: errTx } = await supabase.from('warehouse_transactions').insert({
          user_id: ownerUserId,
          part_number: pn,
          quantity: item.quantity ?? 1,
          type: 'IN',
          source_type: 'ORDER',
          source_id: pedido.id,
          site: pedido.site || '',
          work_order: pedido.wo || '',
        })
        if (errTx) throw errTx
      }

      // 2. Crear lista "Uso de repuestos - {WO}"
      const nombreLista = `Uso de repuestos - ${pedido.wo || String(pedido.id).slice(0, 8)}`
      const { data: lista, error: errLista } = await supabase
        .from('spare_part_lists')
        .insert({
          user_id: ownerUserId,
          name: nombreLista,
          site: pedido.site || '',
          work_order: pedido.wo || '',
        })
        .select('*')
        .single()

      if (errLista) throw errLista

      const listaItems = pedido.items
        .filter(i => i.spare_part_id)
        .map(i => ({
          list_id: lista.id,
          spare_part_id: i.spare_part_id,
          quantity: i.quantity ?? 1,
        }))

      if (listaItems.length) {
        const { error: errItemsLista } = await supabase
          .from('spare_part_list_items')
          .insert(listaItems)
        if (errItemsLista) throw errItemsLista
      }

      await db.sparePartLists.add({
        idRemoto: lista.id,
        userId: ownerUserId,
        name: nombreLista,
        site: pedido.site || '',
        workOrder: pedido.wo || '',
        itemCount: listaItems.length,
        inventorySynced: false,
        inventorySyncedAt: null,
        creadoEn: lista.created_at,
      })

      // 3. Marcar el pedido como recepcionado
      const { error: errUpd } = await supabase
        .from('pedidos')
        .update({
          estado: 'recepcionado',
          recepcionado_por_id: personaRec?.id || null,
          recepcionado_por_nombre: personaRec?.nombre || '',
          entregado_por_id: personaEnt?.id || null,
          entregado_por_nombre: personaEnt?.nombre || '',
          recepcionado_at: ahora,
          updated_at: ahora,
        })
        .eq('id', pedido.id)

      if (errUpd) throw errUpd

      await db.pedidos.filter(p => p.idRemoto === pedido.id).modify({
        estado: 'recepcionado',
        recepcionadoPorNombre: personaRec?.nombre || '',
        entregadoPorNombre: personaEnt?.nombre || '',
        recepcionadoAt: ahora,
      })

      setPedidos(prev => prev.map(p => p.id === pedido.id
        ? {
            ...p,
            estado: 'recepcionado',
            recepcionado_por_nombre: personaRec?.nombre || '',
            entregado_por_nombre: personaEnt?.nombre || '',
            recepcionado_at: ahora,
          }
        : p
      ))

      setRecepcionAbierta(false)
      setPedidoRecepcion(null)
      setMensaje({
        color: 'success',
        texto: `Pedido recepcionado: inventario actualizado y lista "${nombreLista}" creada.`,
      })
    } catch (e) {
      setErrorRecepcion(
        e.message ||
        'Ocurrió un error durante la recepción. Revisa el inventario y las listas antes de reintentar.'
      )
    } finally {
      setConfirmandoRecepcion(false)
    }
  }

  function totalUnidades(pedido) {
    return (pedido.items || []).reduce((suma, i) => suma + (i.quantity ?? 1), 0)
  }

  return (
    <div className="space-y-4">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Pedidos"
          description={mensaje.texto}
          onClose={() => setMensaje(null)}
        />
      )}

      <Tabs selectedKey={pestana} onSelectionChange={setPestana} aria-label="Secciones de pedidos">
        <Tab key="pedidos" title="Pedidos">
          <div className="pt-3">
            <Card shadow="sm">
              <CardHeader className="flex items-center justify-between gap-3 pb-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-default-400" />
                  <p className="text-sm font-semibold">Pedidos</p>
                  <span className="text-xs text-default-400">({pedidos.length})</span>
                </div>
                <Button size="sm" color="primary" variant="flat" startContent={<Plus size={16} />} onPress={abrirNuevo}>
                  Nuevo pedido
                </Button>
              </CardHeader>
              <Divider className="mt-3" />
              <CardBody>
                {cargando ? (
                  <p className="text-sm text-default-400 py-4 text-center">Cargando pedidos...</p>
                ) : pedidos.length === 0 ? (
                  <p className="text-sm text-default-400 py-4 text-center">
                    No hay pedidos. Crea uno con repuestos y datos del WO (del catálogo o manuales).
                  </p>
                ) : (
                  <ul className="divide-y divide-default-100">
                    {pedidos.map(pedido => (
                      <li key={pedido.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setPedidoDetalle(pedido)}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-default-900">
                                {pedido.wo || `Pedido ${String(pedido.id).slice(0, 8)}`}
                              </p>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={pedido.estado === 'recepcionado' ? 'success' : 'warning'}
                              >
                                {pedido.estado === 'recepcionado' ? 'Recepcionado' : 'Guardado'}
                              </Chip>
                            </div>
                            <p className="text-xs text-default-500 mt-0.5">
                              {[
                                pedido.id_atm && `ID: ${pedido.id_atm}`,
                                pedido.site && `Site: ${pedido.site}`,
                                pedido.modelo && `Modelo: ${pedido.modelo}`,
                                `${(pedido.items || []).length} repuestos · ${totalUnidades(pedido)} uds.`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                            {pedido.estado === 'recepcionado' && (
                              <p className="text-xs text-default-400 mt-0.5">
                                {[
                                  pedido.recepcionado_por_nombre && `Recibió: ${pedido.recepcionado_por_nombre}`,
                                  pedido.entregado_por_nombre && `Entregó: ${pedido.entregado_por_nombre}`,
                                  pedido.recepcionado_at && formatearFechaHora(pedido.recepcionado_at),
                                ].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </button>
                          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                            {pedido.estado === 'guardado' && (
                              <Button
                                size="sm"
                                color="success"
                                variant="flat"
                                startContent={<ClipboardCheck size={15} />}
                                onPress={() => abrirRecepcion(pedido)}
                              >
                                Recepcionar
                              </Button>
                            )}
                            {pedido.estado === 'guardado' && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                aria-label="Eliminar pedido"
                                onPress={() => setEliminando(pedido)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </Tab>

        {esAdmin && (
          <Tab key="personas" title="Personas">
            <div className="pt-3">
              <PersonasPedidos />
            </div>
          </Tab>
        )}
      </Tabs>

      {/* Modal: nuevo pedido */}
      <Modal isOpen={nuevoAbierto} onOpenChange={setNuevoAbierto} placement="center" size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Nuevo pedido</ModalHeader>
          <ModalBody className="gap-3">
            <Autocomplete
              label="Cargar desde Wo's (opcional)"
              placeholder="Busca por WO, ID o nombre de equipo"
              selectedKey={woCatalogoKey}
              onSelectionChange={seleccionarWoCatalogo}
              isLoading={catalogosCargando}
              emptyContent="Sin workorders. Puedes ingresar los datos manualmente."
            >
              {wosCatalogo.map(w => (
                <AutocompleteItem key={w.wo} textValue={`${w.wo} ${w.codigo_equipo || ''} ${w.nombre_equipo || ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{w.wo}</span>
                    {w.fecha && <span className="text-xs text-default-400">{formatearFecha(w.fecha)}</span>}
                  </div>
                  <span className="text-xs text-default-400">
                    {[w.codigo_equipo, w.nombre_equipo].filter(Boolean).join(' · ')}
                  </span>
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="WO" placeholder="Manual o desde catálogo" value={formWo} onValueChange={setFormWo} />
              <Input label="ID ATM" placeholder="ID del cajero" value={formIdAtm} onValueChange={setFormIdAtm} />
              <Input label="Site" placeholder="Nombre del equipo" value={formSite} onValueChange={setFormSite} />
              <Input label="Modelo" placeholder="Modelo del equipo" value={formModelo} onValueChange={setFormModelo} />
              <Input label="Dirección" placeholder="Dirección del ATM" value={formDireccion} onValueChange={setFormDireccion} />
            </div>

            <Divider />

            <p className="text-xs font-semibold uppercase tracking-wide text-default-400">Repuestos del pedido</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Autocomplete
                className="flex-1"
                label="Repuesto"
                placeholder="Busca por nombre o part number"
                selectedKey={itemRepuestoId || null}
                onSelectionChange={key => setItemRepuestoId(key || '')}
                isLoading={catalogosCargando}
                emptyContent="Sin repuestos disponibles."
              >
                {repuestos.map(r => (
                  <AutocompleteItem key={r.id} textValue={`${r.nombre} ${r.part_number}`}>
                    <span className="text-sm">{r.nombre}</span>
                    <span className="text-xs text-default-400">{r.part_number}</span>
                  </AutocompleteItem>
                ))}
              </Autocomplete>
              <Input
                className="w-full sm:w-24"
                label="Cant."
                type="number"
                min={1}
                value={itemCantidadStr}
                onValueChange={setItemCantidadStr}
              />
              <Button
                color="primary"
                variant="flat"
                startContent={<Plus size={16} />}
                onPress={agregarItemForm}
                isDisabled={!itemRepuestoId}
              >
                Agregar
              </Button>
            </div>

            {itemsForm.length > 0 && (
              <ul className="divide-y divide-default-100 rounded-lg border border-default-200">
                {itemsForm.map(item => (
                  <li key={item.spare_part_id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-default-900 truncate">{item.nombre}</p>
                      <p className="text-xs text-default-400">{item.part_number} · {item.quantity} uds.</p>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      aria-label="Quitar repuesto"
                      onPress={() => quitarItemForm(item.spare_part_id)}
                    >
                      <X size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setNuevoAbierto(false)} startContent={<X size={16} />}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={guardarPedido}
              isLoading={guardandoPedido}
              isDisabled={!itemsForm.length}
              startContent={<Check size={16} />}
            >
              Guardar pedido
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: recepción */}
      <Modal isOpen={recepcionAbierta} onOpenChange={setRecepcionAbierta} placement="center" size="md">
        <ModalContent>
          <ModalHeader>
            Recepcionar pedido — {pedidoRecepcion?.wo || String(pedidoRecepcion?.id || '').slice(0, 8)}
          </ModalHeader>
          <ModalBody className="gap-3">
            <p className="text-sm text-default-600">
              Al confirmar, todo el pedido ingresará al inventario personal del almacén y se creará la lista{' '}
              <strong>Uso de repuestos - {pedidoRecepcion?.wo || String(pedidoRecepcion?.id || '').slice(0, 8)}</strong>.
            </p>

            <ul className="divide-y divide-default-100 rounded-lg border border-default-200">
              {(pedidoRecepcion?.items || []).map(item => (
                <li key={item.id || item.spare_part_id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-default-900 truncate">{item.repuesto?.nombre || '—'}</p>
                    <p className="text-xs text-default-400">{item.repuesto?.part_number || ''}</p>
                  </div>
                  <Chip size="sm" variant="flat">{item.quantity ?? 1} uds.</Chip>
                </li>
              ))}
            </ul>

            <Autocomplete
              label="Quién recepcionó la llamada/pedido (opcional)"
              placeholder="Seleccionar persona"
              selectedKey={recepcionPorId}
              onSelectionChange={key => setRecepcionPorId(key || 'ninguno')}
              emptyContent="Sin personas de recepción. Gestiónalas en la pestaña Personas (admin)."
            >
              <AutocompleteItem key="ninguno" textValue="Sin asignar">— Sin asignar —</AutocompleteItem>
              {personas.filter(p => p.tipo === 'recepcion').map(p => (
                <AutocompleteItem key={p.id} textValue={p.nombre}>
                  {p.nombre}
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Autocomplete
              label="Motorizado que entregó el pedido (opcional)"
              placeholder="Seleccionar motorizado"
              selectedKey={entregaPorId}
              onSelectionChange={key => setEntregaPorId(key || 'ninguno')}
              emptyContent="Sin motorizados. Gestiónalos en la pestaña Personas (admin)."
            >
              <AutocompleteItem key="ninguno" textValue="Sin asignar">— Sin asignar —</AutocompleteItem>
              {personas.filter(p => p.tipo === 'entrega').map(p => (
                <AutocompleteItem key={p.id} textValue={p.nombre}>
                  {p.nombre}
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Input
              label="Fecha y hora de recepción"
              value={formatearFechaHora(new Date().toISOString())}
              isReadOnly
              description="Se registra al confirmar la recepción."
            />

            {errorRecepcion && (
              <HeroAlert color="danger" title="Error en la recepción" description={errorRecepcion} />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setRecepcionAbierta(false)} startContent={<X size={16} />}>
              Cancelar
            </Button>
            <Button
              color="success"
              onPress={confirmarRecepcion}
              isLoading={confirmandoRecepcion}
              startContent={<ClipboardCheck size={16} />}
            >
              Confirmar recepción
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: detalle */}
      <Modal isOpen={Boolean(pedidoDetalle)} onOpenChange={setPedidoDetalle} placement="center" size="md">
        <ModalContent>
          <ModalHeader>
            Detalle del pedido — {pedidoDetalle?.wo || String(pedidoDetalle?.id || '').slice(0, 8)}
          </ModalHeader>
          <ModalBody className="gap-3">
            <div className="space-y-1 text-sm">
              <p><span className="text-default-400">WO:</span> {pedidoDetalle?.wo || '—'}</p>
              <p><span className="text-default-400">ID ATM:</span> {pedidoDetalle?.id_atm || '—'}</p>
              <p><span className="text-default-400">Site:</span> {pedidoDetalle?.site || '—'}</p>
              <p><span className="text-default-400">Modelo:</span> {pedidoDetalle?.modelo || '—'}</p>
              <p><span className="text-default-400">Dirección:</span> {pedidoDetalle?.direccion || '—'}</p>
              <p>
                <span className="text-default-400">Estado:</span>{' '}
                <Chip size="sm" variant="flat" color={pedidoDetalle?.estado === 'recepcionado' ? 'success' : 'warning'}>
                  {pedidoDetalle?.estado === 'recepcionado' ? 'Recepcionado' : 'Guardado'}
                </Chip>
              </p>
              {pedidoDetalle?.estado === 'recepcionado' && (
                <>
                  <p><span className="text-default-400">Recibió:</span> {pedidoDetalle?.recepcionado_por_nombre || '—'}</p>
                  <p><span className="text-default-400">Entregó:</span> {pedidoDetalle?.entregado_por_nombre || '—'}</p>
                  <p><span className="text-default-400">Fecha recepción:</span> {formatearFechaHora(pedidoDetalle?.recepcionado_at)}</p>
                </>
              )}
            </div>

            <Divider />

            <p className="text-xs font-semibold uppercase tracking-wide text-default-400">Repuestos</p>
            <ul className="divide-y divide-default-100">
              {(pedidoDetalle?.items || []).map(item => (
                <li key={item.id || item.spare_part_id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <ChevronRight size={14} className="text-default-300 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-default-900 truncate">{item.repuesto?.nombre || 'Repuesto'}</p>
                      <p className="text-xs text-default-400">{item.repuesto?.part_number || ''}</p>
                    </div>
                  </div>
                  <Chip size="sm" variant="flat" startContent={<Package size={12} />}>
                    {item.quantity ?? 1}
                  </Chip>
                </li>
              ))}
            </ul>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setPedidoDetalle(null)}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: eliminar pedido */}
      <Modal isOpen={Boolean(eliminando)} onOpenChange={() => setEliminando(null)} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>Eliminar pedido</ModalHeader>
          <ModalBody>
            <p className="text-sm">
              ¿Eliminar el pedido <strong>{eliminando?.wo || String(eliminando?.id || '').slice(0, 8)}</strong> y todos sus items? Solo se pueden eliminar pedidos guardados.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEliminando(null)}>
              Cancelar
            </Button>
            <Button color="danger" onPress={eliminarPedido} isLoading={eliminandoConfirmado}>
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

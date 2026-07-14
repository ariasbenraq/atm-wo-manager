import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useIsAdmin } from '../hooks/usePermissions'
import {
  Input, Button, Chip,
  ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Autocomplete, AutocompleteItem,
} from '@heroui/react'
import {
  List, Plus, Minus, ArrowLeft, Pencil, Trash2, Copy, Share2, X, Check, Warehouse, ChevronRight,
} from 'lucide-react'

function tiempoRelativo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const dias = Math.floor(hrs / 24)
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

export default function MisListasPage() {
  const { session } = useApp()
  const userId = session?.user?.id
  const esAdmin = useIsAdmin()

  const [listas, setListas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoSite, setNuevoSite] = useState('')
  const [nuevoWorkOrder, setNuevoWorkOrder] = useState('')
  const [errorNombre, setErrorNombre] = useState(null)
  const [guardandoLista, setGuardandoLista] = useState(false)

  const [listaActiva, setListaActiva] = useState(null)
  const [items, setItems] = useState([])
  const [cargandoItems, setCargandoItems] = useState(false)

  const [editandoNombre, setEditandoNombre] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editSite, setEditSite] = useState('')
  const [editWorkOrder, setEditWorkOrder] = useState('')
  const [errorEdit, setErrorEdit] = useState(null)

  const [eliminando, setEliminando] = useState(null)
  const [copiando, setCopiando] = useState(false)
  const [copiandoItemId, setCopiandoItemId] = useState(null)

  const [editandoItem, setEditandoItem] = useState(null)
  const [editItemCantidadStr, setEditItemCantidadStr] = useState('1')
  const [editItemRepuestoId, setEditItemRepuestoId] = useState(null)
  const [editItemRepuestos, setEditItemRepuestos] = useState([])
  const [editItemCargando, setEditItemCargando] = useState(false)
  const [guardandoItem, setGuardandoItem] = useState(false)

  const [agregandoItem, setAgregandoItem] = useState(false)
  const [agregarItemRepuestoId, setAgregarItemRepuestoId] = useState(null)
  const [agregarItemCantidadStr, setAgregarItemCantidadStr] = useState('1')
  const [agregarItemRepuestos, setAgregarItemRepuestos] = useState([])
  const [agregarItemCargando, setAgregarItemCargando] = useState(false)
  const [guardandoAgregarItem, setGuardandoAgregarItem] = useState(false)

  const [sincronizando, setSincronizando] = useState(false)
  const [confirmarSync, setConfirmarSync] = useState(false)
  const [erroresSync, setErroresSync] = useState([])

  const cargarListas = useCallback(async () => {
    if (!esAdmin && !userId) return
    setCargando(true)
    try {
      let query = supabase
        .from('spare_part_lists')
        .select('*')
      if (!esAdmin && userId) {
        query = query.eq('user_id', userId)
      }
      const { data, error } = await query.order('updated_at', { ascending: false })

      if (error) throw error

      let usuariosMap = {}
      if (esAdmin) {
        const { data: perfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
        if (perfiles) {
          usuariosMap = Object.fromEntries(perfiles.map(p => [p.id, p]))
        }
      }

      const listasConConteo = await Promise.all((data || []).map(async lista => {
        const { count } = await supabase
          .from('spare_part_list_items')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', lista.id)
        return { ...lista, itemCount: count || 0, usuario: usuariosMap[lista.user_id] || null }
      }))

      setListas(listasConConteo)

      await db.sparePartLists.clear()
      if (data?.length) {
        await db.sparePartLists.bulkAdd(data.map(l => ({
          idRemoto: l.id,
          userId: l.user_id,
          name: l.name,
          site: l.site || '',
          workOrder: l.work_order || '',
          inventorySynced: l.inventory_synced || false,
          inventorySyncedAt: l.inventory_synced_at || null,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        })))
      }
    } catch {
      const local = await db.sparePartLists.orderBy('localId').reverse().toArray()
      setListas(local.map(l => ({
        id: l.idRemoto,
        name: l.name,
        site: l.site || '',
        workOrder: l.workOrder || '',
        inventory_synced: l.inventorySynced || false,
        inventory_synced_at: l.inventorySyncedAt || null,
        itemCount: 0,
        updated_at: l.updatedAt,
      })))
    } finally {
      setCargando(false)
    }
  }, [userId, esAdmin])

  useEffect(() => {
    cargarListas()
  }, [cargarListas])

  async function cargarItems(lista) {
    setListaActiva(lista)
    setCargandoItems(true)
    try {
      const { data, error } = await supabase
        .from('spare_part_list_items')
        .select('*')
        .eq('list_id', lista.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const sparePartIds = (data || []).map(i => i.spare_part_id)
      const { data: repuestos } = sparePartIds.length
        ? await supabase.from('repuestos').select('id, nombre, part_number').in('id', sparePartIds)
        : { data: [] }

      const repuestoMap = new Map((repuestos || []).map(r => [r.id, r]))
      setItems((data || []).map(i => ({ ...i, quantity: i.quantity ?? 1, repuesto: repuestoMap.get(i.spare_part_id) || null })))

      await db.sparePartListItems.clear()
      if (data?.length) {
        await db.sparePartListItems.bulkAdd(data.map(i => ({
          idRemoto: i.id,
          listId: i.list_id,
          sparePartId: i.spare_part_id,
          quantity: i.quantity ?? 1,
          createdAt: i.created_at,
        })))
      }
    } catch {
      const local = await db.sparePartListItems.toArray()
      setItems(local.map(i => ({
        id: i.idRemoto,
        list_id: i.listId,
        spare_part_id: i.sparePartId,
        repuesto: null,
      })))
    } finally {
      setCargandoItems(false)
    }
  }

  function cerrarLista() {
    setListaActiva(null)
    setItems([])
    setEditandoNombre(false)
    setEliminando(null)
    if (editandoItem) cerrarEditarItem()
  }

  async function crearLista() {
    if (guardandoLista) return
    setGuardandoLista(true)
    setErrorNombre(null)
    try {
      const name = nuevoNombre.trim()
      const site = nuevoSite.trim()
      const workOrder = nuevoWorkOrder.trim()
      if (!name) {
        setErrorNombre('El nombre es obligatorio.')
        return
      }

      const { data, error } = await supabase
        .from('spare_part_lists')
        .insert({ user_id: userId, name, site, work_order: workOrder })
        .select('*')
        .single()

      if (error) {
        setErrorNombre(error.message)
        return
      }

      await db.sparePartLists.add({
        idRemoto: data.id,
        userId: data.user_id,
        name: data.name,
        site: data.site || '',
        workOrder: data.work_order || '',
        inventorySynced: false,
        inventorySyncedAt: null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      })

      setListas(prev => [{ ...data, itemCount: 0 }, ...prev])
      setCreando(false)
      setNuevoNombre('')
      setNuevoSite('')
      setNuevoWorkOrder('')
      setMensaje({ color: 'success', texto: `Lista "${data.name}" creada.` })
    } finally {
      setGuardandoLista(false)
    }
  }

  async function actualizarNombre() {
    if (!listaActiva) return
    setErrorEdit(null)
    const name = editNombre.trim()
    const site = editSite.trim()
    const workOrder = editWorkOrder.trim()
    if (!name) {
      setErrorEdit('El nombre es obligatorio.')
      return
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('spare_part_lists')
      .update({ name, site, work_order: workOrder, updated_at: now })
      .eq('id', listaActiva.id)
      .select('*')
      .single()

    if (error) {
      setErrorEdit(error.message)
      return
    }

    await db.sparePartLists.filter(l => l.idRemoto === listaActiva.id).modify({ name, site, workOrder })

    setListas(prev => prev.map(l => (l.id === data.id ? { ...l, name: data.name, site: data.site || '', work_order: data.work_order || '', inventory_synced: data.inventory_synced || false, inventory_synced_at: data.inventory_synced_at || null, updated_at: now } : l)))
    setListaActiva(prev => ({ ...prev, name: data.name, site: data.site || '', work_order: data.work_order || '', inventory_synced: data.inventory_synced || false, inventory_synced_at: data.inventory_synced_at || null, updated_at: now }))
    setEditandoNombre(false)
    setMensaje({ color: 'success', texto: 'Lista actualizada.' })
  }

  async function eliminarLista() {
    if (!eliminando) return

    const { error } = await supabase
      .from('spare_part_lists')
      .delete()
      .eq('id', eliminando.id)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    await db.sparePartLists.filter(l => l.idRemoto === eliminando.id).delete()
    await db.sparePartListItems.where('listId').equals(eliminando.id).delete()

    const esActiva = listaActiva?.id === eliminando.id
    setListas(prev => prev.filter(l => l.id !== eliminando.id))
    setEliminando(null)
    if (esActiva) cerrarLista()
    setMensaje({ color: 'success', texto: `Lista "${eliminando.name}" eliminada.` })
  }

  async function abrirEditarItem(item) {
    setEditandoItem(item)
    setEditItemCantidadStr(String(item.quantity ?? 1))
    setEditItemRepuestoId(item.spare_part_id)
    setEditItemCargando(true)
    try {
      const { data } = await supabase
        .from('repuestos')
        .select('id, nombre, part_number')
        .order('nombre')
      setEditItemRepuestos(data || [])
    } catch {
      setEditItemRepuestos([])
    } finally {
      setEditItemCargando(false)
    }
  }

  function cerrarEditarItem() {
    setEditandoItem(null)
    setEditItemCantidadStr('1')
    setEditItemRepuestoId(null)
    setEditItemRepuestos([])
    setEditItemCargando(false)
  }

  async function guardarEditarItem() {
    if (!editandoItem || !editItemRepuestoId) return
    setGuardandoItem(true)
    const cantidad = Math.max(1, parseInt(editItemCantidadStr, 10) || 1)
    try {
      const { error } = await supabase
        .from('spare_part_list_items')
        .update({ spare_part_id: editItemRepuestoId, quantity: cantidad })
        .eq('id', editandoItem.id)

      if (error) {
        setMensaje({ color: 'danger', texto: error.message })
        return
      }

      const repuesto = editItemRepuestos.find(r => r.id === editItemRepuestoId)
        || (editandoItem.repuesto?.id === editItemRepuestoId ? editandoItem.repuesto : null)

      setItems(prev => prev.map(i =>
        i.id === editandoItem.id
          ? { ...i, spare_part_id: editItemRepuestoId, quantity: cantidad, repuesto }
          : i
      ))

      await db.sparePartListItems.filter(i => i.idRemoto === editandoItem.id).modify({
        sparePartId: editItemRepuestoId,
        quantity: cantidad,
      })

      cerrarEditarItem()
      setMensaje({ color: 'success', texto: 'Item actualizado.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'Error al guardar.' })
    } finally {
      setGuardandoItem(false)
    }
  }

  async function agregarItemALista() {
    if (!listaActiva || !agregarItemRepuestoId) return
    setGuardandoAgregarItem(true)
    const cantidad = Math.max(1, parseInt(agregarItemCantidadStr, 10) || 1)
    try {
      const { data, error } = await supabase
        .from('spare_part_list_items')
        .insert({ list_id: listaActiva.id, spare_part_id: agregarItemRepuestoId, quantity: cantidad })
        .select('*')
        .single()

      if (error && error.code !== '23505') {
        setMensaje({ color: 'danger', texto: error.message })
        return
      }

      const repuesto = agregarItemRepuestos.find(r => r.id === agregarItemRepuestoId) || null

      const nuevoItem = {
        id: data?.id || `temp-${Date.now()}`,
        list_id: listaActiva.id,
        spare_part_id: agregarItemRepuestoId,
        quantity: cantidad,
        repuesto,
      }

      setItems(prev => [...prev, nuevoItem])

      await db.sparePartListItems.add({
        idRemoto: data?.id || nuevoItem.id,
        listId: listaActiva.id,
        sparePartId: agregarItemRepuestoId,
        quantity: cantidad,
        createdAt: new Date().toISOString(),
      })

      setListas(prev => prev.map(l =>
        l.id === listaActiva.id ? { ...l, itemCount: (l.itemCount || 0) + 1 } : l
      ))

      setAgregandoItem(false)
      setAgregarItemRepuestoId(null)
      setAgregarItemCantidadStr('1')
      setMensaje({ color: 'success', texto: 'Repuesto agregado a la lista.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'Error al agregar.' })
    } finally {
      setGuardandoAgregarItem(false)
    }
  }

  async function actualizarCantidad(item, cantidad) {
    if (cantidad < 1) return

    const { error } = await supabase
      .from('spare_part_list_items')
      .update({ quantity: cantidad })
      .eq('id', item.id)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, quantity: cantidad } : i
    ))

    try {
      await db.sparePartListItems.update(item.id, { quantity: cantidad })
    } catch { /* silent */ }
  }

  async function copiarPartNumberYUnidades(item) {
    const texto = `${item.repuesto?.part_number || ''}\t${item.quantity ?? 1}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        const ta = document.createElement('textarea')
        ta.value = texto
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiandoItemId(item.id)
      setTimeout(() => setCopiandoItemId(null), 2000)
    } catch {
      setMensaje({ color: 'danger', texto: 'No se pudo copiar.' })
    }
  }

  async function eliminarItem(itemId) {
    const { error } = await supabase
      .from('spare_part_list_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    setItems(prev => prev.filter(i => i.id !== itemId))

    const nuevoConteo = items.length - 1
    setListas(prev => prev.map(l =>
      l.id === listaActiva.id ? { ...l, itemCount: nuevoConteo } : l
    ))
  }

  async function copiarLista() {
    if (!listaActiva || !items.length) return

    const lineas = items.map((item, idx) =>
      `${idx + 1}. ${item.repuesto?.nombre || '?'}\n   Part Number: ${item.repuesto?.part_number || '?'}\n   Unidades: ${item.quantity ?? 1}`
    )
    const texto = `${listaActiva.name}\n\n${lineas.join('\n\n')}`

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        const ta = document.createElement('textarea')
        ta.value = texto
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiando(true)
      setTimeout(() => setCopiando(false), 2000)
    } catch {
      setMensaje({ color: 'danger', texto: 'No se pudo copiar.' })
    }
  }

  async function compartirLista() {
    if (!listaActiva || !items.length) return

    const lineas = items.map((item, idx) =>
      `${idx + 1}. ${item.repuesto?.nombre || '?'}\n   Part Number: ${item.repuesto?.part_number || '?'}\n   Unidades: ${item.quantity ?? 1}`
    )
    const texto = `${listaActiva.name}\n\n${lineas.join('\n\n')}`

    if (navigator.share) {
      try {
        await navigator.share({ title: listaActiva.name, text: texto })
        return
      } catch {
        // user cancelled or error
      }
    }

    // Fallback: copy
    await copiarLista()
  }

  async function sincronizarConAlmacen() {
    if (!listaActiva || !items.length || !userId) return
    setSincronizando(true)
    try {
      const partNumbers = items.map(i => i.repuesto?.part_number).filter(Boolean)
      const { data: warehouseItems } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('user_id', userId)
        .in('part_number', partNumbers)

      const whMap = new Map((warehouseItems || []).map(w => [w.part_number, w]))
      const errores = []

      for (const item of items) {
        const pn = item.repuesto?.part_number
        if (!pn) continue
        const qty = item.quantity ?? 1
        const wh = whMap.get(pn)
        if (!wh) {
          errores.push({ partNumber: pn, required: qty, available: 0 })
        } else if (wh.quantity < qty) {
          errores.push({ partNumber: pn, required: qty, available: wh.quantity })
        }
      }

      if (errores.length) {
        setErroresSync(errores)
        setConfirmarSync(false)
        setSincronizando(false)
        return
      }

      for (const item of items) {
        const pn = item.repuesto?.part_number
        if (!pn) continue
        const qty = item.quantity ?? 1
        const wh = whMap.get(pn)
        if (!wh) continue

        const nuevaCantidad = wh.quantity - qty
        await supabase
          .from('warehouse_items')
          .update({ quantity: nuevaCantidad, updated_at: new Date().toISOString() })
          .eq('id', wh.id)

        await db.warehouseItems.filter(i => i.idRemoto === wh.id).modify({ quantity: nuevaCantidad })

        await supabase.from('warehouse_transactions').insert({
          user_id: userId,
          part_number: pn,
          quantity: qty,
          type: 'OUT',
          source_type: 'LIST',
          source_id: listaActiva.id,
          site: listaActiva.site || '',
          work_order: listaActiva.work_order || listaActiva.workOrder || '',
        })
      }

      const now = new Date().toISOString()
      await supabase
        .from('spare_part_lists')
        .update({ inventory_synced: true, inventory_synced_at: now })
        .eq('id', listaActiva.id)

      await db.sparePartLists.filter(l => l.idRemoto === listaActiva.id).modify({
        inventorySynced: true,
        inventorySyncedAt: now,
      })

      setListas(prev => prev.map(l =>
        l.id === listaActiva.id ? { ...l, inventory_synced: true, inventory_synced_at: now } : l
      ))
      setListaActiva(prev => ({ ...prev, inventory_synced: true, inventory_synced_at: now }))
      setConfirmarSync(false)
      setMensaje({ color: 'success', texto: 'Inventario sincronizado correctamente.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'Error al sincronizar inventario.' })
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="space-y-4">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Listas de repuestos"
          description={mensaje.texto}
        />
      )}

      {!listaActiva ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
                <List size={20} />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-default-900 leading-tight">Mis listas de repuestos</h2>
                <p className="text-sm text-default-500">
                  Agrupa repuestos para revisarlos o dictarlos por teléfono
                </p>
              </div>
            </div>
            <Button
              color="primary"
              radius="lg"
              startContent={<Plus size={16} />}
              onPress={() => {
                setNuevoNombre('')
                setNuevoSite('')
                setNuevoWorkOrder('')
                setErrorNombre(null)
                setCreando(true)
              }}
              className="shrink-0 shadow-sm"
            >
              Crear lista
            </Button>
          </div>

          {cargando ? (
            <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
              Cargando listas...
            </div>
          ) : listas.length === 0 ? (
            <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
              Aún no tienes listas. Crea una para empezar a agrupar repuestos.
            </div>
          ) : (
            <div className="space-y-2.5">
              {listas.map(lista => (
                <div
                  key={lista.id}
                  className="group rounded-xl border border-default-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:shadow-[0_4px_16px_0_rgb(0_0_0/0.08)] hover:border-primary-200/60 hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]"
                  onClick={() => cargarItems(lista)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') cargarItems(lista) }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[15px] font-semibold text-default-900 leading-tight truncate group-hover:text-primary-700 transition-colors">
                        {lista.name}
                      </p>
                      <div className="text-[13px] text-default-500 flex flex-wrap gap-x-2 items-center">
                        <span className="font-medium text-default-600">{lista.itemCount} repuesto{lista.itemCount === 1 ? '' : 's'}</span>
                        {lista.site ? <span className="text-default-400">· {lista.site}</span> : null}
                        {lista.work_order || lista.workOrder ? <span className="text-default-400">· {lista.work_order || lista.workOrder}</span> : null}
                        {lista.updated_at ? <span className="text-default-400">· {tiempoRelativo(lista.updated_at)}</span> : null}
                        {lista.inventory_synced ? <Chip color="success" variant="flat" size="sm" radius="lg" className="text-[10px] h-5">Sinc.</Chip> : null}
                        {esAdmin && lista.usuario ? <span className="text-default-400">· {lista.usuario.email || lista.usuario.full_name || lista.user_id?.slice(0, 8)}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="text-[12px] font-medium text-default-500 hover:text-default-700 hover:bg-default-100 h-8 px-2.5 min-w-0 md:hidden"
                        onPress={e => { e.stopPropagation(); cargarItems(lista) }}
                      >
                        Ver
                      </Button>
                      <ChevronRight size={16} className="text-default-300 group-hover:text-default-500 transition-colors hidden md:block" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={cerrarLista}
              aria-label="Volver"
            >
              <ArrowLeft size={18} />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-default-900 truncate">
                {listaActiva.name}
              </h2>
              <div className="text-xs text-default-500">
                {items.length} repuesto{items.length === 1 ? '' : 's'}
                {listaActiva.site ? <span className="ml-2">· {listaActiva.site}</span> : null}
                {listaActiva.work_order || listaActiva.workOrder ? <span className="ml-2">· {listaActiva.work_order || listaActiva.workOrder}</span> : null}
                {listaActiva.inventory_synced ? <Chip color="success" variant="flat" size="sm" radius="lg" className="ml-2 text-[10px] h-5">Sinc. {listaActiva.inventory_synced_at ? new Date(listaActiva.inventory_synced_at).toLocaleDateString('es-ES') : ''}</Chip> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 shrink-0 justify-end">
              <Button
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Agregar repuesto"
                startContent={<Plus size={14} />}
                className="text-[13px] font-medium h-8 px-2.5"
                onPress={() => {
                  setAgregandoItem(true)
                  setAgregarItemRepuestoId(null)
                  setAgregarItemCantidadStr('1')
                  setAgregarItemRepuestos([])
                  setAgregarItemCargando(true)
                  supabase.from('repuestos').select('id, nombre, part_number').order('nombre').then(({ data }) => {
                    setAgregarItemRepuestos(data || [])
                    setAgregarItemCargando(false)
                  })
                }}
              >
                Agregar
              </Button>
              <Button
                size="sm"
                variant="light"
                radius="lg"
                startContent={<Warehouse size={14} />}
                className={`text-[13px] font-medium h-8 px-2.5 ${listaActiva.inventory_synced ? 'text-success' : ''}`}
                aria-label="Sincronizar con almacén"
                isDisabled={sincronizando}
                isLoading={sincronizando}
                onPress={() => setConfirmarSync(true)}
              >
                {listaActiva.inventory_synced ? 'Sincronizado' : 'Sinc. Inventario'}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Editar lista"
                onPress={() => {
                  setEditNombre(listaActiva.name)
                  setEditSite(listaActiva.site || '')
                  setEditWorkOrder(listaActiva.work_order || listaActiva.workOrder || '')
                  setErrorEdit(null)
                  setEditandoNombre(true)
                }}
              >
                <Pencil size={16} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Eliminar lista"
                onPress={() => setEliminando(listaActiva)}
              >
                <Trash2 size={16} className="text-danger" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Copiar lista"
                onPress={copiarLista}
              >
                {copiando ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Compartir lista"
                onPress={compartirLista}
              >
                <Share2 size={16} />
              </Button>
            </div>
          </div>

          <div className="border-b border-default-100" />

          {cargandoItems ? (
            <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
              Cargando repuestos...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-default-200 bg-white px-5 py-6 text-sm text-default-400 flex flex-col items-center gap-4">
              <span>Esta lista no tiene repuestos.</span>
              <Button
                color="primary"
                variant="flat"
                radius="lg"
                size="sm"
                startContent={<Plus size={14} />}
                onPress={() => {
                  setAgregandoItem(true)
                  setAgregarItemRepuestoId(null)
                  setAgregarItemCantidadStr('1')
                  setAgregarItemRepuestos([])
                  setAgregarItemCargando(true)
                  supabase.from('repuestos').select('id, nombre, part_number').order('nombre').then(({ data }) => {
                    setAgregarItemRepuestos(data || [])
                    setAgregarItemCargando(false)
                  })
                }}
              >
                Agregar repuesto
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="block md:hidden space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-default-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-default-900 truncate">
                          {item.repuesto?.nombre || '—'}
                        </p>
                        <p className="text-[12px] font-mono text-default-400 truncate mt-0.5">
                          {item.repuesto?.part_number || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="min-w-7 h-7 text-default-400 hover:text-default-700 data-[disabled=true]:opacity-30"
                          isDisabled={(item.quantity ?? 1) <= 1}
                          onPress={() => actualizarCantidad(item, (item.quantity ?? 1) - 1)}
                        >
                          <Minus size={13} />
                        </Button>
                        <span className="font-mono text-[15px] font-semibold text-default-700 tabular-nums w-7 text-center">
                          {item.quantity ?? 1}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="min-w-7 h-7 text-default-400 hover:text-default-700"
                          onPress={() => actualizarCantidad(item, (item.quantity ?? 1) + 1)}
                        >
                          <Plus size={13} />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-default-100">
                      <Button
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="flex-1 text-[12px] font-medium text-default-500 hover:bg-default-100 h-8 min-w-0"
                        startContent={copiandoItemId === item.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                        onPress={() => copiarPartNumberYUnidades(item)}
                      >
                        {copiandoItemId === item.id ? 'Copiado' : 'Copiar'}
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-8 h-8 text-default-400 hover:text-default-600"
                        onPress={() => abrirEditarItem(item)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="min-w-8 h-8 text-default-400 hover:text-danger"
                        onPress={() => eliminarItem(item.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table layout */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-default-200 bg-white shadow-sm">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400 items-center">
                  <span>Nombre</span>
                  <span className="text-center">Unidades</span>
                  <span className="text-center">Copiar a GCEW</span>
                  <span className="text-center">Editar</span>
                  <span className="text-center">Eliminar</span>
                </div>
                <ScrollShadow className="max-h-[55vh]">
                  <div className="divide-y divide-default-100/80">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-1.5 items-center transition-colors hover:bg-default-50/60"
                      >
                        <div className="flex flex-col min-w-0">
                          <p className="truncate text-[14px] font-medium text-default-900">
                            {item.repuesto?.nombre || '—'}
                          </p>
                          <p className="text-[12px] font-mono text-default-400 truncate">
                            {item.repuesto?.part_number || '—'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="min-w-6 h-6 text-default-400 hover:text-default-700 data-[disabled=true]:opacity-30"
                            isDisabled={(item.quantity ?? 1) <= 1}
                            onPress={() => actualizarCantidad(item, (item.quantity ?? 1) - 1)}
                          >
                            <Minus size={12} />
                          </Button>
                          <span className="font-mono text-[14px] font-semibold text-default-700 tabular-nums w-7 text-center">
                            {item.quantity ?? 1}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="min-w-6 h-6 text-default-400 hover:text-default-700"
                            onPress={() => actualizarCantidad(item, (item.quantity ?? 1) + 1)}
                          >
                            <Plus size={12} />
                          </Button>
                        </div>
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="font-semibold text-[11px] text-default-500 hover:text-default-700 h-7 px-2 min-w-0"
                            onPress={() => copiarPartNumberYUnidades(item)}
                          >
                            {copiandoItemId === item.id ? (
                              <Check size={13} className="text-success" />
                            ) : (
                              'Copiar'
                            )}
                          </Button>
                        </div>
                        <div className="flex items-center justify-center">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="text-default-300 hover:text-default-600 min-w-7 h-7"
                            onPress={() => abrirEditarItem(item)}
                          >
                            <Pencil size={13} />
                          </Button>
                        </div>
                        <div className="flex items-center justify-center">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="text-default-300 hover:text-danger min-w-7 h-7"
                            onPress={() => eliminarItem(item.id)}
                          >
                            <X size={13} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="light"
              radius="lg"
              startContent={copiando ? <Check size={16} className="text-success-500" /> : <Copy size={16} />}
              onPress={copiarLista}
              isDisabled={!items.length}
              className="flex-1 text-[14px] font-medium text-default-600 hover:bg-default-100 h-9"
            >
              {copiando ? 'Copiado' : 'Copiar lista'}
            </Button>
            <Button
              variant="light"
              radius="lg"
              startContent={<Share2 size={16} />}
              onPress={compartirLista}
              isDisabled={!items.length}
              className="flex-1 text-[14px] font-medium text-default-600 hover:bg-default-100 h-9"
            >
              Compartir
            </Button>
          </div>
        </>
      )}

      <Modal isOpen={creando} onOpenChange={abierto => !abierto && setCreando(false)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Crear nueva lista</ModalHeader>
            <ModalBody>
              <Input
                label="Nombre de la lista"
                placeholder="Ej. Repuestos preventivo"
                value={nuevoNombre}
                onValueChange={v => {
                  setNuevoNombre(v)
                  if (errorNombre) setErrorNombre(null)
                }}
                isInvalid={Boolean(errorNombre)}
                errorMessage={errorNombre}
                variant="bordered"
                radius="lg"
                autoFocus
              />
              <Input
                label="Site"
                placeholder="Ej. SITIO001"
                value={nuevoSite}
                onValueChange={v => setNuevoSite(v)}
                variant="bordered"
                radius="lg"
                className="mt-3"
              />
              <Input
                label="Work Order"
                placeholder="Ej. WO-2025-00123"
                value={nuevoWorkOrder}
                onValueChange={v => setNuevoWorkOrder(v)}
                variant="bordered"
                radius="lg"
                className="mt-3"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setCreando(false)}>
                Cancelar
              </Button>
              <Button color="primary" onPress={crearLista} isDisabled={guardandoLista} isLoading={guardandoLista}>
                Crear lista
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={editandoNombre} onOpenChange={abierto => !abierto && setEditandoNombre(false)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Editar lista</ModalHeader>
            <ModalBody>
              <Input
                label="Nombre de la lista"
                value={editNombre}
                onValueChange={v => {
                  setEditNombre(v)
                  if (errorEdit) setErrorEdit(null)
                }}
                isInvalid={Boolean(errorEdit)}
                errorMessage={errorEdit}
                variant="bordered"
                radius="lg"
                autoFocus
              />
              <Input
                label="Site"
                placeholder="Ej. SITIO001"
                value={editSite}
                onValueChange={v => setEditSite(v)}
                variant="bordered"
                radius="lg"
                className="mt-3"
              />
              <Input
                label="Work Order"
                placeholder="Ej. WO-2025-00123"
                value={editWorkOrder}
                onValueChange={v => setEditWorkOrder(v)}
                variant="bordered"
                radius="lg"
                className="mt-3"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setEditandoNombre(false)}>
                Cancelar
              </Button>
              <Button color="primary" onPress={actualizarNombre}>
                Guardar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(editandoItem)} onOpenChange={abierto => !abierto && cerrarEditarItem()}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Editar item</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Autocomplete
                    label="Repuesto"
                    placeholder="Buscar por nombre o part number..."
                    defaultItems={editItemRepuestos}
                    selectedKey={editItemRepuestoId}
                    onSelectionChange={key => setEditItemRepuestoId(key)}
                    variant="bordered"
                    radius="lg"
                    isLoading={editItemCargando}
                    isDisabled={editItemCargando}
                    autoFocus
                  >
                    {r => (
                      <AutocompleteItem key={r.id} textValue={`${r.nombre} ${r.part_number}`}>
                        <span>{r.nombre}</span>
                        <span className="text-default-400 ml-2 font-mono text-xs">{r.part_number}</span>
                      </AutocompleteItem>
                    )}
                  </Autocomplete>
                  <Input
                    label="Unidades"
                    type="text"
                    inputMode="numeric"
                    value={editItemCantidadStr}
                    onValueChange={setEditItemCantidadStr}
                    variant="bordered"
                    radius="lg"
                  />
                </div>
              </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={cerrarEditarItem}>
                Cancelar
              </Button>
              <Button color="primary" onPress={guardarEditarItem} isDisabled={guardandoItem || !editItemRepuestoId} isLoading={guardandoItem}>
                Guardar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={agregandoItem} onOpenChange={abierto => !abierto && setAgregandoItem(false)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Agregar repuesto</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Autocomplete
                  label="Repuesto"
                  placeholder="Buscar por nombre o part number..."
                  defaultItems={agregarItemRepuestos}
                  selectedKey={agregarItemRepuestoId}
                  onSelectionChange={key => setAgregarItemRepuestoId(key)}
                  variant="bordered"
                  radius="lg"
                  isLoading={agregarItemCargando}
                  isDisabled={agregarItemCargando}
                  autoFocus
                >
                  {r => (
                    <AutocompleteItem key={r.id} textValue={`${r.nombre} ${r.part_number}`}>
                      <span>{r.nombre}</span>
                      <span className="text-default-400 ml-2 font-mono text-xs">{r.part_number}</span>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <Input
                  label="Cantidad"
                  type="text"
                  inputMode="numeric"
                  value={agregarItemCantidadStr}
                  onValueChange={setAgregarItemCantidadStr}
                  variant="bordered"
                  radius="lg"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setAgregandoItem(false)}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={agregarItemALista}
                isDisabled={guardandoAgregarItem || !agregarItemRepuestoId}
                isLoading={guardandoAgregarItem}
              >
                Agregar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={confirmarSync} onOpenChange={abierto => !abierto && setConfirmarSync(false)}>
        <ModalContent>
          <ModalHeader className="text-default-900">Sincronizar con almacén</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Esta acción descontará las cantidades de esta lista de tu inventario en el almacén.
            </p>
            <p className="text-sm text-default-600 mt-2">
              Verifica que todas las cantidades sean correctas antes de continuar.
            </p>
            <p className="text-xs text-warning font-medium mt-2">
              Esta acción afectará tu stock disponible.
            </p>
            <div className="rounded-xl border border-default-200 bg-default-50 p-3 mt-3 space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-default-700 truncate mr-2">{item.repuesto?.part_number || '—'}</span>
                  <span className="font-mono text-default-500 tabular-nums shrink-0">-{item.quantity ?? 1}</span>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setConfirmarSync(false)}>Cancelar</Button>
            <Button color="primary" onPress={sincronizarConAlmacen} isLoading={sincronizando} isDisabled={sincronizando}>
              Confirmar sincronización
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={erroresSync.length > 0} onOpenChange={abierto => !abierto && setErroresSync([])}>
        <ModalContent>
          <ModalHeader className="text-default-900">Stock insuficiente</ModalHeader>
          <ModalBody>
            <p className="text-sm text-danger mb-3">
              Los siguientes repuestos no tienen suficiente inventario:
            </p>
            {erroresSync.map((err, idx) => (
              <div key={idx} className="rounded-xl border border-danger-200 bg-danger-50 p-3 mb-2">
                <p className="font-mono text-sm font-semibold text-danger-700">{err.partNumber}</p>
                <div className="flex gap-4 mt-1 text-xs text-danger-600">
                  <span>Requerido: {err.required}</span>
                  <span>Disponible: {err.available}</span>
                </div>
              </div>
            ))}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setErroresSync([])}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(eliminando)} onOpenChange={abierto => !abierto && setEliminando(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Eliminar lista</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Estás seguro de eliminar la lista <strong>&quot;{eliminando?.name}&quot;</strong>?
              </p>
              <p className="text-xs text-danger mt-1">Esta acción no se puede deshacer.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setEliminando(null)}>
                Cancelar
              </Button>
              <Button color="danger" onPress={eliminarLista}>
                Eliminar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

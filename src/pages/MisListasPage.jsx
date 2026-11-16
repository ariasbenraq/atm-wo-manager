import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useIsAdmin } from '../hooks/usePermissions'
import { useLegajo } from '../hooks/useLegajo'
import EnviarFormularioModal from '../components/EnviarFormularioModal'
import { consumirLista, revertirConsumoLista, mensajeErrorInventario } from '../lib/inventario'
import {
  Input, Button, Chip,
  ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Autocomplete, AutocompleteItem,
} from '@heroui/react'
import { cargarWosDeLegajo } from '../lib/wosCatalogo'
import { coincideBusqueda } from '../lib/busqueda'
import { siteDeWo } from '../lib/wosCache'
import { formatearFecha } from '../lib/date'
import OpcionDosLineas from '../components/ui/OpcionDosLineas'
import { LISTA_DOS_LINEAS, CLASE_DOS_LINEAS } from '../components/ui/listaOpciones'
import {
  List, Plus, Minus, ArrowLeft, Search, Pencil, Trash2, Copy, Share2, X, Check, Warehouse, ChevronRight, Undo2, Send,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

// Dos procesos independientes (en cualquier orden): descontar del almacén y enviar al Google Form
function EstadoChips({ lista, className = 'ml-2', mostrarForm = true }) {
  const sincronizada = Boolean(lista.inventory_synced)
  const enviada = Boolean(lista.form_enviado_en)
  return (
    <span className={`${className} inline-flex flex-wrap items-center gap-1 align-middle`}>
      <Chip size="sm" variant="flat" radius="lg" color={sincronizada ? 'success' : 'warning'} className="h-5 text-xs">
        {sincronizada ? 'Almacén: descontada' : 'Almacén: pendiente'}
      </Chip>
      {mostrarForm && <Chip size="sm" variant="flat" radius="lg" color={enviada ? 'primary' : 'default'} className="h-5 text-xs">
        {enviada ? 'Formulario: enviado' : 'Formulario: pendiente'}
      </Chip>}
    </span>
  )
}

function contrataDe(lista, userId, profile) {
  const esDeOtro = Boolean(lista?.user_id && lista.user_id !== userId)
  return String((esDeOtro ? lista?.usuario?.contrata : profile?.contrata) || '').toUpperCase()
}

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
  const { session, profile } = useApp()
  const userId = session?.user?.id
  const esAdmin = useIsAdmin()

  const [listas, setListas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [creando, setCreando] = useState(false)
  const [busquedaWo, setBusquedaWo] = useState('')
  const [pasoCrear, setPasoCrear] = useState('elegir') // 'elegir' | 'confirmar'
  // WOs del legajo del usuario para elegir al crear una lista
  const [wosLegajo, setWosLegajo] = useState([])
  const [wosCargando, setWosCargando] = useState(false)
  const [woClaveNueva, setWoClaveNueva] = useState(null)
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
  const legajoUsuario = useLegajo()
  const [enviandoForm, setEnviandoForm] = useState(false)
  // Un admin puede abrir la lista de otro técnico: el formulario lleva el legajo del dueño
  const esDeOtro = Boolean(listaActiva?.user_id && listaActiva.user_id !== userId)
  const legajoDeLista = esDeOtro
    ? String(listaActiva.usuario?.legajo || '').replace(/\s+/g, '').toUpperCase()
    : legajoUsuario
  // Solo los técnicos de la contrata IDERKA pueden usar el formulario de consumo
  const puedeEnviarForm = contrataDe(listaActiva, userId, profile) === 'IDERKA'
  const [confirmarSync, setConfirmarSync] = useState(false)
  // Correo registrado del técnico dueño de la lista (el formulario lo pide)
  const emailDeLista = esDeOtro
    ? (listaActiva.usuario?.email || '')
    : (profile?.email || session?.user?.email || '')
  const [stockSync, setStockSync] = useState(null) // Map(part_number -> stock) | 'error' | null
  const [erroresSync, setErroresSync] = useState([])
  const [revirtiendo, setRevirtiendo] = useState(false)
  const [motivoReversion, setMotivoReversion] = useState('')
  const [guardandoReversion, setGuardandoReversion] = useState(false)

  // Una lista ya descontada del almacén no se edita: hay que revertir primero
  const listaSincronizada = Boolean(listaActiva?.inventory_synced)
  const AVISO_SINCRONIZADA = 'Lista sincronizada con el almacén. Revierte la sincronización para modificarla.'

  // Al abrir la confirmación, lee el stock actual para mostrar «antes → después»
  useEffect(() => {
    if (!confirmarSync || !listaActiva) {
      setStockSync(null)
      return
    }
    let activo = true
    const pns = [...new Set(items.map(i => i.repuesto?.part_number).filter(Boolean))]
    supabase
      .from('warehouse_items')
      .select('part_number, quantity')
      .eq('user_id', listaActiva.user_id || userId)
      .in('part_number', pns)
      .then(({ data, error }) => {
        if (!activo) return
        if (error) { setStockSync('error'); return }
        setStockSync(new Map((data || []).map(r => [r.part_number, r.quantity ?? 0])))
      })
    return () => { activo = false }
    // Solo al abrir/cerrar la confirmación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmarSync])

  const previewSync = useMemo(() => {
    const necesario = new Map()
    for (const i of items) {
      const pn = i.repuesto?.part_number
      if (!pn) continue
      const previo = necesario.get(pn) || { pn, nombre: i.repuesto?.nombre || '', cantidad: 0 }
      previo.cantidad += i.quantity ?? 1
      necesario.set(pn, previo)
    }
    return [...necesario.values()].map(r => {
      const stock = stockSync instanceof Map ? (stockSync.get(r.pn) ?? 0) : null
      return { ...r, stock, despues: stock === null ? null : stock - r.cantidad, falta: stock !== null && stock < r.cantidad }
    })
  }, [items, stockSync])
  const stockCargado = stockSync instanceof Map
  const hayFaltantes = previewSync.some(r => r.falta)

  const cargarListas = useCallback(async () => {
    if (!userId) return
    setCargando(true)
    try {
      // Cada usuario (admin incluido) ve solo las listas creadas por él; la RLS también lo impone
      const { data, error } = await supabase
        .from('spare_part_lists')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      const listasConConteo = await Promise.all((data || []).map(async lista => {
        const { count } = await supabase
          .from('spare_part_list_items')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', lista.id)
        return { ...lista, itemCount: count || 0, usuario: null }
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
          formEnviadoEn: l.form_enviado_en || null,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        })))
      }
    } catch {
      const local = await db.sparePartLists.orderBy('localId').reverse().toArray()
      setListas(local.filter(l => l.userId === userId).map(l => ({
        id: l.idRemoto,
        user_id: l.userId,
        name: l.name,
        site: l.site || '',
        workOrder: l.workOrder || '',
        inventory_synced: l.inventorySynced || false,
        inventory_synced_at: l.inventorySyncedAt || null,
        form_enviado_en: l.formEnviadoEn || null,
        itemCount: 0,
        updated_at: l.updatedAt,
      })))
    } finally {
      setCargando(false)
    }
  }, [userId])

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

  const woNueva = wosLegajo.find(w => w.wo === woClaveNueva) || null
  // El nombre se genera solo: ID del equipo · site · WO
  const wosFiltradasNueva = wosLegajo
    .filter(w => coincideBusqueda([w.wo, w.codigo_equipo, siteDeWo(w), w.fecha ? formatearFecha(w.fecha) : ''], busquedaWo))
    .slice(0, 100)
  const nombreAutomatico = w => [w.codigo_equipo, siteDeWo(w), w.wo].filter(Boolean).join(' · ')

  async function abrirCrearLista() {
    setPasoCrear('elegir')
    setBusquedaWo('')
    setWoClaveNueva(null)
    setErrorNombre(null)
    setCreando(true)
    setWosCargando(true)
    try {
      setWosLegajo(await cargarWosDeLegajo(legajoUsuario))
    } catch {
      setWosLegajo([])
    } finally {
      setWosCargando(false)
    }
  }

  async function crearLista() {
    if (guardandoLista) return
    setGuardandoLista(true)
    setErrorNombre(null)
    try {
      if (!woNueva) {
        setErrorNombre('Elige una workorder de tu legajo.')
        return
      }
      const name = nombreAutomatico(woNueva)
      const site = siteDeWo(woNueva)
      const workOrder = woNueva.wo

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
      setBusquedaWo('')
      setWoClaveNueva(null)
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
    if (eliminando.inventory_synced) {
      setEliminando(null)
      setMensaje({ color: 'warning', texto: AVISO_SINCRONIZADA })
      return
    }

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
    if (listaSincronizada) {
      setMensaje({ color: 'warning', texto: AVISO_SINCRONIZADA })
      return
    }
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
    if (listaSincronizada) {
      setMensaje({ color: 'warning', texto: AVISO_SINCRONIZADA })
      return
    }
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
    if (cantidad < 1 || listaSincronizada) return

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
      await db.sparePartListItems.filter(i => i.idRemoto === item.id).modify({ quantity: cantidad })
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
    if (listaSincronizada) {
      setMensaje({ color: 'warning', texto: AVISO_SINCRONIZADA })
      return
    }
    const { error } = await supabase
      .from('spare_part_list_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    setItems(prev => prev.filter(i => i.id !== itemId))

    try {
      await db.sparePartListItems.filter(i => i.idRemoto === itemId).delete()
    } catch { /* silent */ }

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

  function marcarSincronizada(sincronizada, fecha) {
    const cambios = { inventory_synced: sincronizada, inventory_synced_at: fecha }
    setListas(prev => prev.map(l => (l.id === listaActiva.id ? { ...l, ...cambios } : l)))
    setListaActiva(prev => ({ ...prev, ...cambios }))
    return db.sparePartLists.filter(l => l.idRemoto === listaActiva.id).modify({
      inventorySynced: sincronizada,
      inventorySyncedAt: fecha,
    })
  }

  function actualizarEstadoFormulario(valor) {
    const cambios = { form_enviado_en: valor }
    setListas(prev => prev.map(l => (l.id === listaActiva.id ? { ...l, ...cambios } : l)))
    setListaActiva(prev => ({ ...prev, ...cambios }))
    db.sparePartLists.filter(l => l.idRemoto === listaActiva.id).modify({ formEnviadoEn: valor }).catch(() => {})
    setMensaje({
      color: 'success',
      texto: valor ? 'Lista marcada como enviada al formulario.' : 'Se quitó la marca de envío al formulario.',
    })
  }

  async function sincronizarConAlmacen() {
    if (!listaActiva || !items.length) return
    setSincronizando(true)
    try {
      // Valida stock, descuenta y marca la lista en una sola operación (descuenta del almacén del dueño)
      const resultado = await consumirLista(listaActiva.id)
      if (!resultado.ok) {
        setErroresSync(resultado.faltantes.map(f => ({
          partNumber: f.part_number,
          required: f.requerido,
          available: f.disponible,
        })))
        setConfirmarSync(false)
        return
      }

      await marcarSincronizada(true, resultado.synced_at)
      setConfirmarSync(false)
      setMensaje({ color: 'success', texto: 'Inventario sincronizado correctamente.' })
    } catch (e) {
      setConfirmarSync(false)
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e, 'Error al sincronizar inventario.') })
    } finally {
      setSincronizando(false)
    }
  }

  async function revertirSincronizacion() {
    if (!listaActiva || !motivoReversion.trim()) return
    setGuardandoReversion(true)
    try {
      await revertirConsumoLista({ listId: listaActiva.id, motivo: motivoReversion.trim() })
      await marcarSincronizada(false, null)
      setRevirtiendo(false)
      setMensaje({ color: 'success', texto: 'Sincronización revertida: los repuestos volvieron al almacén y la lista se puede editar.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: mensajeErrorInventario(e, 'Error al revertir la sincronización.') })
    } finally {
      setGuardandoReversion(false)
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
          <PageHeader
            icon={List}
            title="Mis listas de repuestos"
            subtitle="Agrupa repuestos para revisarlos o dictarlos por teléfono"
            actions={
              <Button
              color="primary"
              radius="lg"
              startContent={<Plus size={16} />}
              onPress={abrirCrearLista}
              className="shrink-0 shadow-sm"
            >
              Crear lista
            </Button>
            }
          />

          {cargando ? (
            <div className="rounded-xl border border-default-200 bg-content1 p-4 text-sm text-default-400">
              Cargando listas...
            </div>
          ) : listas.length === 0 ? (
            <div className="rounded-xl border border-default-200 bg-content1 p-4 text-sm text-default-400">
              Aún no tienes listas. Crea una para empezar a agrupar repuestos.
            </div>
          ) : (
            <div className="space-y-2.5">
              {listas.map(lista => (
                <div
                  key={lista.id}
                  className="group rounded-xl border border-default-200 bg-content1 p-4 shadow-sm transition-all duration-200 hover:shadow-[0_4px_16px_0_rgb(0_0_0/0.08)] hover:border-primary-200/60 hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]"
                  onClick={() => cargarItems(lista)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') cargarItems(lista) }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-semibold text-default-900 leading-tight truncate group-hover:text-primary-700 transition-colors">
                        {lista.name}
                      </p>
                      <div className="text-sm text-default-500 flex flex-wrap gap-x-2 items-center">
                        <span className="font-medium text-default-600">{lista.itemCount} repuesto{lista.itemCount === 1 ? '' : 's'}</span>
                        {lista.site ? <span className="text-default-400">· {lista.site}</span> : null}
                        {lista.work_order || lista.workOrder ? <span className="text-default-400">· {lista.work_order || lista.workOrder}</span> : null}
                        {lista.updated_at ? <span className="text-default-400">· {tiempoRelativo(lista.updated_at)}</span> : null}
                        {esAdmin && lista.usuario ? <span className="text-default-400">· {lista.usuario.email || lista.usuario.full_name || lista.user_id?.slice(0, 8)}</span> : null}
                      </div>
                      <EstadoChips lista={lista} className="" mostrarForm={contrataDe(lista, userId, profile) === 'IDERKA'} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span aria-hidden="true" className="px-2.5 text-xs font-medium text-default-500 md:hidden">Ver</span>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
            <div className="min-w-0 flex-1 basis-40">
              <h2 className="text-base font-semibold text-foreground truncate">
                {listaActiva.name}
              </h2>
              <div className="text-xs text-default-500">
                {items.length} repuesto{items.length === 1 ? '' : 's'}
                {listaActiva.site ? <span className="ml-2">· {listaActiva.site}</span> : null}
                {listaActiva.work_order || listaActiva.workOrder ? <span className="ml-2">· {listaActiva.work_order || listaActiva.workOrder}</span> : null}
                <EstadoChips lista={listaActiva} mostrarForm={puedeEnviarForm} />
              </div>
            </div>
            <div className="flex w-full flex-wrap justify-start gap-1 md:w-auto md:shrink-0 md:justify-end">
              <Button
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Agregar repuesto"
                startContent={<Plus size={14} />}
                className="text-sm font-medium h-8 px-2.5"
                isDisabled={listaSincronizada}
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
                startContent={listaSincronizada ? <Undo2 size={14} /> : <Warehouse size={14} />}
                className="text-sm font-medium h-8 px-2.5"
                aria-label={listaSincronizada ? 'Revertir sincronización' : 'Sincronizar con almacén'}
                isDisabled={sincronizando || guardandoReversion}
                isLoading={sincronizando}
                onPress={() => {
                  if (listaSincronizada) {
                    setMotivoReversion('')
                    setRevirtiendo(true)
                  } else {
                    setConfirmarSync(true)
                  }
                }}
              >
                {listaSincronizada ? 'Revertir sinc.' : 'Sinc. Inventario'}
              </Button>
              {puedeEnviarForm && <Button
                size="sm"
                variant="light"
                radius="lg"
                startContent={<Send size={14} />}
                className="text-sm font-medium h-8 px-2.5"
                aria-label="Enviar al formulario"
                isDisabled={!items.length}
                onPress={() => setEnviandoForm(true)}
              >
                Enviar al form.
              </Button>}
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
                isDisabled={listaSincronizada}
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

          {listaSincronizada && (
            <HeroAlert color="success" variant="flat" title="Descontada del almacén" description={AVISO_SINCRONIZADA} />
          )}

          {cargandoItems ? (
            <div className="rounded-xl border border-default-200 bg-content1 p-4 text-sm text-default-400">
              Cargando repuestos...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-default-200 bg-content1 p-6 text-sm text-default-400 flex flex-col items-center gap-4">
              <span>Esta lista no tiene repuestos.</span>
              <Button
                color="primary"
                variant="flat"
                radius="lg"
                size="sm"
                startContent={<Plus size={14} />}
                isDisabled={listaSincronizada}
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
                    className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-default-900 truncate">
                          {item.repuesto?.nombre || '—'}
                        </p>
                        <p className="text-xs font-mono text-default-400 truncate mt-0.5">
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
                          isDisabled={listaSincronizada || (item.quantity ?? 1) <= 1}
                          onPress={() => actualizarCantidad(item, (item.quantity ?? 1) - 1)}
                        >
                          <Minus size={13} />
                        </Button>
                        <span className="font-mono text-base font-semibold text-default-700 tabular-nums w-7 text-center">
                          {item.quantity ?? 1}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="min-w-7 h-7 text-default-400 hover:text-default-700"
                          isDisabled={listaSincronizada}
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
                        className="flex-1 text-xs font-medium text-default-500 hover:bg-default-100 h-8 min-w-0"
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
                        isDisabled={listaSincronizada}
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
                        isDisabled={listaSincronizada}
                        onPress={() => eliminarItem(item.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table layout */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-default-200 bg-content1 shadow-sm">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-default-400 items-center">
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
                          <p className="truncate text-sm font-medium text-default-900">
                            {item.repuesto?.nombre || '—'}
                          </p>
                          <p className="text-xs font-mono text-default-400 truncate">
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
                            isDisabled={listaSincronizada || (item.quantity ?? 1) <= 1}
                            onPress={() => actualizarCantidad(item, (item.quantity ?? 1) - 1)}
                          >
                            <Minus size={12} />
                          </Button>
                          <span className="font-mono text-sm font-semibold text-default-700 tabular-nums w-7 text-center">
                            {item.quantity ?? 1}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="lg"
                            className="min-w-6 h-6 text-default-400 hover:text-default-700"
                            isDisabled={listaSincronizada}
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
                            className="font-semibold text-xs text-default-500 hover:text-default-700 h-7 px-2 min-w-0"
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
                            isDisabled={listaSincronizada}
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
                            isDisabled={listaSincronizada}
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
              className="flex-1 text-sm font-medium text-default-600 hover:bg-default-100 h-9"
            >
              {copiando ? 'Copiado' : 'Copiar lista'}
            </Button>
            <Button
              variant="light"
              radius="lg"
              startContent={<Share2 size={16} />}
              onPress={compartirLista}
              isDisabled={!items.length}
              className="flex-1 text-sm font-medium text-default-600 hover:bg-default-100 h-9"
            >
              Compartir
            </Button>
          </div>
        </>
      )}

      <Modal
        isOpen={creando}
        onOpenChange={abierto => !abierto && setCreando(false)}
        placement="center"
        scrollBehavior="inside"
      >
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">
              {pasoCrear === 'elegir' ? 'Crear nueva lista' : 'Confirmar nueva lista'}
            </ModalHeader>
            <ModalBody>
              {pasoCrear === 'elegir' ? (
                <>
                  <Input
                    aria-label="Buscar workorder"
                    placeholder="Busca por WO, ID, site o fecha"
                    value={busquedaWo}
                    onValueChange={v => { setBusquedaWo(v); setErrorNombre(null) }}
                    variant="bordered"
                    radius="lg"
                    size="sm"
                    startContent={<Search size={15} className="text-default-400" />}
                    isClearable
                    onClear={() => setBusquedaWo('')}
                  />
                  {wosCargando ? (
                    <p className="text-sm text-default-500">Cargando workorders...</p>
                  ) : wosFiltradasNueva.length === 0 ? (
                    <p className="text-sm text-default-500">
                      {!legajoUsuario
                        ? 'Tu perfil no tiene legajo asignado.'
                        : wosLegajo.length === 0
                          ? 'No hay workorders asignadas a tu legajo.'
                          : 'Ninguna workorder coincide con la búsqueda.'}
                    </p>
                  ) : (
                    <ul role="listbox" aria-label="Workorders de tu legajo" className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
                      {wosFiltradasNueva.map(w => {
                        const activa = w.wo === woClaveNueva
                        return (
                          <li key={w.wo} role="option" aria-selected={activa}>
                            <button
                              type="button"
                              onClick={() => { setWoClaveNueva(w.wo); setErrorNombre(null) }}
                              className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                                activa
                                  ? 'border-primary bg-primary-50'
                                  : 'border-default-200 bg-content1 hover:bg-default-100'
                              }`}
                            >
                              <OpcionDosLineas
                                principal={w.wo}
                                derecha={w.fecha ? formatearFecha(w.fecha) : ''}
                                secundario={[w.codigo_equipo, siteDeWo(w)].filter(Boolean).join(' · ') || 'Sin ID ni site'}
                              />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {errorNombre && <p className="text-xs text-danger" role="alert">{errorNombre}</p>}
                </>
              ) : woNueva ? (
                <>
                  <p className="text-sm text-default-600">Revisa los datos antes de crear la lista:</p>
                  <dl className="space-y-2 rounded-xl border border-default-200 bg-default-50 p-3 text-sm">
                    {[
                      ['Workorder', woNueva.wo],
                      ['ID', woNueva.codigo_equipo || '—'],
                      ['Site', siteDeWo(woNueva) || '—'],
                      ['Fecha', woNueva.fecha ? formatearFecha(woNueva.fecha) : '—'],
                      ['Nombre de la lista', nombreAutomatico(woNueva)],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="flex gap-3">
                        <dt className="w-32 shrink-0 text-default-500">{etiqueta}</dt>
                        <dd className="min-w-0 break-words font-medium text-foreground">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                  {errorNombre && <p className="text-xs text-danger" role="alert">{errorNombre}</p>}
                </>
              ) : null}
            </ModalBody>
            <ModalFooter>
              {pasoCrear === 'elegir' ? (
                <>
                  <Button variant="light" onPress={() => setCreando(false)}>
                    Cancelar
                  </Button>
                  <Button color="primary" onPress={() => setPasoCrear('confirmar')} isDisabled={!woNueva}>
                    Continuar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="light" onPress={() => setPasoCrear('elegir')} isDisabled={guardandoLista} startContent={<ArrowLeft size={16} />}>
                    Atrás
                  </Button>
                  <Button color="primary" onPress={crearLista} isDisabled={guardandoLista || !woNueva} isLoading={guardandoLista}>
                    Confirmar y crear
                  </Button>
                </>
              )}
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
                    {...LISTA_DOS_LINEAS}
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
                      <AutocompleteItem key={r.id} className={CLASE_DOS_LINEAS} textValue={`${r.nombre} ${r.part_number}`}>
                        <OpcionDosLineas principal={r.nombre} derecha={r.part_number} derechaMono />
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
                  {...LISTA_DOS_LINEAS}
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
                    <AutocompleteItem key={r.id} className={CLASE_DOS_LINEAS} textValue={`${r.nombre} ${r.part_number}`}>
                      <OpcionDosLineas principal={r.nombre} derecha={r.part_number} derechaMono />
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

      <EnviarFormularioModal
        isOpen={enviandoForm && puedeEnviarForm}
        onClose={() => setEnviandoForm(false)}
        lista={listaActiva}
        items={items}
        legajo={legajoDeLista}
        email={emailDeLista}
        onEstadoCambiado={actualizarEstadoFormulario}
        onPresupuestoGuardado={(id, valor) => setItems(prev => prev.map(i => (i.id === id ? { ...i, presupuesto: valor } : i)))}
      />

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
            <div className="rounded-xl border border-default-200 bg-default-50 p-3 mt-3 space-y-2">
              {previewSync.map(r => (
                <div key={r.pn} className={`text-sm ${r.falta ? 'text-danger' : ''}`}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-mono">{r.pn}</span>
                    <span className="shrink-0 font-mono tabular-nums">-{r.cantidad}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs text-default-500">
                    <span className="truncate">{r.nombre}</span>
                    <span className="shrink-0 tabular-nums">
                      {r.stock === null ? 'Stock…' : r.falta
                        ? `Stock ${r.stock}: faltan ${r.cantidad - r.stock}`
                        : `Stock ${r.stock} → ${r.despues}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {stockSync === 'error' && (
              <p className="mt-2 text-xs text-danger">No se pudo leer el stock. Revisa tu conexión e inténtalo de nuevo.</p>
            )}
            {hayFaltantes && (
              <p className="mt-2 text-xs font-medium text-danger">
                No hay stock suficiente para sincronizar. Ajusta la lista o ingresa los repuestos al almacén.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setConfirmarSync(false)}>Cancelar</Button>
            <Button color="primary" onPress={sincronizarConAlmacen} isLoading={sincronizando} isDisabled={sincronizando || !stockCargado || hayFaltantes}>
              Confirmar sincronización
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={revirtiendo} onOpenChange={abierto => !abierto && setRevirtiendo(false)}>
        <ModalContent>
          <ModalHeader className="text-default-900">Revertir sincronización</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Se devolverá al almacén lo que esta lista descontó y la lista quedará editable para corregirla y volver a sincronizar.
            </p>
            <p className="text-xs text-default-400 mt-1">
              Se registra como ajuste en el historial del almacén.
            </p>
            <Input
              label="Motivo"
              placeholder="Ej.: cantidad errada, repuesto equivocado"
              value={motivoReversion}
              onValueChange={setMotivoReversion}
              variant="bordered"
              radius="lg"
              isRequired
              className="mt-3"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRevirtiendo(false)}>Cancelar</Button>
            <Button
              color="warning"
              onPress={revertirSincronizacion}
              isLoading={guardandoReversion}
              isDisabled={guardandoReversion || !motivoReversion.trim()}
            >
              Revertir
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

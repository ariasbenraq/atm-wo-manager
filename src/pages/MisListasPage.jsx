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
  List, Plus, ArrowLeft, Pencil, Trash2, Copy, Share2, X, Check,
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
  const [errorNombre, setErrorNombre] = useState(null)
  const [guardandoLista, setGuardandoLista] = useState(false)

  const [listaActiva, setListaActiva] = useState(null)
  const [items, setItems] = useState([])
  const [cargandoItems, setCargandoItems] = useState(false)

  const [editandoNombre, setEditandoNombre] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [errorEdit, setErrorEdit] = useState(null)

  const [eliminando, setEliminando] = useState(null)
  const [copiando, setCopiando] = useState(false)
  const [copiandoItemId, setCopiandoItemId] = useState(null)

  const [editandoItem, setEditandoItem] = useState(null)
  const [editItemCantidad, setEditItemCantidad] = useState(1)
  const [editItemRepuestoId, setEditItemRepuestoId] = useState(null)
  const [editItemRepuestos, setEditItemRepuestos] = useState([])
  const [editItemCargando, setEditItemCargando] = useState(false)
  const [guardandoItem, setGuardandoItem] = useState(false)

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
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        })))
      }
    } catch {
      const local = await db.sparePartLists.orderBy('localId').reverse().toArray()
      setListas(local.map(l => ({
        id: l.idRemoto,
        name: l.name,
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
      if (!name) {
        setErrorNombre('El nombre es obligatorio.')
        return
      }

      const { data, error } = await supabase
        .from('spare_part_lists')
        .insert({ user_id: userId, name })
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
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      })

      setListas(prev => [{ ...data, itemCount: 0 }, ...prev])
      setCreando(false)
      setNuevoNombre('')
      setMensaje({ color: 'success', texto: `Lista "${data.name}" creada.` })
    } finally {
      setGuardandoLista(false)
    }
  }

  async function actualizarNombre() {
    if (!listaActiva) return
    setErrorEdit(null)
    const name = editNombre.trim()
    if (!name) {
      setErrorEdit('El nombre es obligatorio.')
      return
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('spare_part_lists')
      .update({ name, updated_at: now })
      .eq('id', listaActiva.id)
      .select('*')
      .single()

    if (error) {
      setErrorEdit(error.message)
      return
    }

    await db.sparePartLists.filter(l => l.idRemoto === listaActiva.id).modify({ name })

    setListas(prev => prev.map(l => (l.id === data.id ? { ...l, name: data.name, updated_at: now } : l)))
    setListaActiva(prev => ({ ...prev, name: data.name, updated_at: now }))
    setEditandoNombre(false)
    setMensaje({ color: 'success', texto: 'Nombre actualizado.' })
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
    setEditItemCantidad(item.quantity ?? 1)
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
    setEditItemCantidad(1)
    setEditItemRepuestoId(null)
    setEditItemRepuestos([])
    setEditItemCargando(false)
  }

  async function guardarEditarItem() {
    if (!editandoItem || !editItemRepuestoId) return
    setGuardandoItem(true)
    try {
      const { error } = await supabase
        .from('spare_part_list_items')
        .update({ spare_part_id: editItemRepuestoId, quantity: editItemCantidad })
        .eq('id', editandoItem.id)

      if (error) {
        setMensaje({ color: 'danger', texto: error.message })
        return
      }

      const repuesto = editItemRepuestos.find(r => r.id === editItemRepuestoId)
        || (editandoItem.repuesto?.id === editItemRepuestoId ? editandoItem.repuesto : null)

      setItems(prev => prev.map(i =>
        i.id === editandoItem.id
          ? { ...i, spare_part_id: editItemRepuestoId, quantity: editItemCantidad, repuesto }
          : i
      ))

      await db.sparePartListItems.filter(i => i.idRemoto === editandoItem.id).modify({
        sparePartId: editItemRepuestoId,
        quantity: editItemCantidad,
      })

      cerrarEditarItem()
      setMensaje({ color: 'success', texto: 'Item actualizado.' })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'Error al guardar.' })
    } finally {
      setGuardandoItem(false)
    }
  }

  async function actualizarCantidad(item, nuevaCantidad) {
    const qty = Math.max(1, Math.floor(Number(nuevaCantidad)) || 1)
    if (qty === (item.quantity ?? 1)) return

    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: qty } : i)))

    const { error } = await supabase
      .from('spare_part_list_items')
      .update({ quantity: qty })
      .eq('id', item.id)

    if (error) {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: item.quantity } : i)))
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    await db.sparePartListItems.filter(i => i.idRemoto === item.id).modify({ quantity: qty })
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
            <div className="space-y-3">
              {listas.map(lista => (
                <div
                  key={lista.id}
                  className="group rounded-xl border border-default-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.06)] hover:border-default-300 cursor-pointer"
                  onClick={() => cargarItems(lista)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') cargarItems(lista) }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[15px] font-semibold text-default-900 leading-tight truncate">
                        {lista.name}
                      </p>
                      <p className="text-[13px] text-default-500">
                        {lista.itemCount} repuesto{lista.itemCount === 1 ? '' : 's'}
                        {lista.updated_at ? ` · ${tiempoRelativo(lista.updated_at)}` : ''}
                        {esAdmin && lista.usuario ? ` · ${lista.usuario.email || lista.usuario.full_name || lista.user_id?.slice(0, 8)}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="light"
                      radius="lg"
                      className="text-[13px] font-medium text-default-600 hover:bg-default-100 h-8 px-3"
                      onPress={() => cargarItems(lista)}
                    >
                      Ver
                    </Button>
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
              <p className="text-xs text-default-500">
                {items.length} repuesto{items.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="lg"
                aria-label="Editar nombre"
                onPress={() => {
                  setEditNombre(listaActiva.name)
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
            <div className="rounded-xl border border-default-200 bg-white px-5 py-4 text-sm text-default-400">
              Esta lista no tiene repuestos. Agrega repuestos desde la página de Repuestos.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-default-200 bg-white">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 border-b border-default-100 bg-default-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400 items-center min-w-[550px]">
                <span>Nombre</span>
                <span>Part Number</span>
                <span className="text-right">Unidades</span>
                <span className="text-center">Copiar a GCEW</span>
                <span className="text-center">Editar</span>
                <span className="text-center">Eliminar</span>
              </div>
              <ScrollShadow className="max-h-[55vh]">
                <div className="divide-y divide-default-100">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 px-4 py-1 items-center transition-colors hover:bg-default-50 min-w-[550px]"
                    >
                      <div className="flex items-center min-w-0 h-7">
                        <p className="truncate text-[14px] font-medium text-default-900">
                          {item.repuesto?.nombre || '—'}
                        </p>
                      </div>
                      <div className="flex items-center h-7">
                        <span className="font-mono text-[13px] text-default-500 tabular-nums">
                          {item.repuesto?.part_number || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-end h-7">
                        <Input
                          type="number"
                          min={1}
                          size="sm"
                          variant="bordered"
                          radius="lg"
                          aria-label="Unidades"
                          value={String(item.quantity ?? 1)}
                          onValueChange={v => actualizarCantidad(item, v)}
                          classNames={{
                            input: 'text-right text-[13px] font-mono tabular-nums',
                            inputWrapper: 'min-h-0 h-7 px-2',
                          }}
                          className="w-16"
                        />
                      </div>
                      <div className="flex items-center justify-center h-7">
                        <Button
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="font-semibold text-[11px] text-default-500 hover:text-default-700 transition-colors duration-150 h-7 px-2 min-w-0"
                          aria-label="Copiar a GCEW"
                          onPress={() => copiarPartNumberYUnidades(item)}
                        >
                          {copiandoItemId === item.id ? (
                            <Check size={13} className="text-success" />
                          ) : (
                            'Copiar'
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center h-7">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="text-default-300 hover:text-default-600 transition-colors duration-150 min-w-7 h-7"
                          aria-label="Editar item"
                          onPress={() => abrirEditarItem(item)}
                        >
                          <Pencil size={13} />
                        </Button>
                      </div>
                      <div className="flex items-center justify-center h-7">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="text-default-300 hover:text-danger transition-colors duration-150 min-w-7 h-7"
                          aria-label="Eliminar de la lista"
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
                placeholder="Ej. ATM Plaza Norte"
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
            <ModalHeader className="text-default-900">Editar nombre</ModalHeader>
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
                    type="number"
                    min={1}
                    value={String(editItemCantidad)}
                    onValueChange={v => setEditItemCantidad(Math.max(1, parseInt(v, 10) || 1))}
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

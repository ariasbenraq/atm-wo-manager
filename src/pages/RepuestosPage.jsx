import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useCan } from '../hooks/usePermissions'
import {
  Input, Button, Chip,
  ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@heroui/react'
import { Boxes, Plus, Search, Check, List, BookmarkPlus } from 'lucide-react'
import RepuestoCard from '../components/RepuestoCard'

export default function RepuestosPage() {
  const { session } = useApp()
  const userId = session?.user?.id
  const puedeCrear = useCan('crear', 'repuestos')
  const puedeEditar = useCan('editar', 'repuestos')

  const [repuestos, setRepuestos] = useState([])
  const [nombre, setNombre] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [compatibilidad, setCompatibilidad] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [repuestoDetalle, setRepuestoDetalle] = useState(null)
  const [repuestoEditando, setRepuestoEditando] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editCompatibilidad, setEditCompatibilidad] = useState('')
  const [editErrores, setEditErrores] = useState({})
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [copiandoId, setCopiandoId] = useState(null)
  const [creandoRepuesto, setCreandoRepuesto] = useState(false)

  const [repuestoSeleccionado, setRepuestoSeleccionado] = useState(null)
  const [listasDisponibles, setListasDisponibles] = useState([])
  const [cargandoListasModal, setCargandoListasModal] = useState(false)
  const [creandoListaModal, setCreandoListaModal] = useState(false)
  const [nombreNuevaLista, setNombreNuevaLista] = useState('')
  const [errorNuevaLista, setErrorNuevaLista] = useState(null)
  const [listaAgregada, setListaAgregada] = useState(null)
  const [guardandoNuevaLista, setGuardandoNuevaLista] = useState(false)
  const [cantidad, setCantidad] = useState(1)

  async function cargarRepuestos() {
    setCargandoLista(true)

    try {
      const { data, error } = await supabase
        .from('repuestos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setRepuestos(data || [])

      await db.repuestos.clear()
      if (data?.length) {
        await db.repuestos.bulkAdd(data.map(r => ({
          idRemoto: r.id,
          nombre: r.nombre,
          partNumber: r.part_number,
          descripcion: r.descripcion || '',
          tieneStock: Boolean(r.tiene_stock),
          compatibilidad: r.compatibility || '',
          creadoEn: r.created_at,
        })))
      }
    } catch {
      const local = await db.repuestos.orderBy('localId').reverse().toArray()
      setRepuestos(local.map(r => ({
        id: r.idRemoto || r.localId,
        nombre: r.nombre,
        part_number: r.partNumber,
        descripcion: r.descripcion || '',
        compatibility: r.compatibilidad || '',
        tiene_stock: Boolean(r.tieneStock),
      })))
      setMensaje({
        color: 'warning',
        texto: 'No se pudo sincronizar con Supabase. Mostrando el inventario local disponible.',
      })
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    cargarRepuestos()
  }, [])

  function validarFormulario() {
    const nuevosErrores = {}

    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio.'
    }

    if (!partNumber.trim()) {
      nuevosErrores.partNumber = 'El part number es obligatorio.'
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  function validarEdicion() {
    const nuevosErrores = {}

    if (!editNombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio.'
    }

    if (!editPartNumber.trim()) {
      nuevosErrores.partNumber = 'El part number es obligatorio.'
    }

    setEditErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function crearRepuesto() {
    setMensaje(null)

    if (!validarFormulario()) return

    const payload = {
      nombre: nombre.trim(),
      part_number: partNumber.trim(),
      descripcion: descripcion.trim(),
      compatibility: compatibilidad.trim() || null,
      created_by: userId,
    }

    const { data, error } = await supabase
      .from('repuestos')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setMensaje({
        color: 'danger',
        texto: error.code === '23505'
          ? 'Ya existe un repuesto con ese part number.'
          : error.message,
      })
      return
    }

    await db.repuestos.add({
      idRemoto: data.id,
      nombre: data.nombre,
      partNumber: data.part_number,
      descripcion: data.descripcion || '',
      tieneStock: Boolean(data.tiene_stock),
      compatibilidad: data.compatibility || '',
      creadoEn: data.created_at,
    })

    setRepuestos(prev => [data, ...prev])
    cerrarCrear()
    setMensaje({ color: 'success', texto: `Repuesto ${data.nombre} agregado correctamente.` })
  }

  function abrirCrear() {
    setMensaje(null)
    setCreandoRepuesto(true)
  }

  function cerrarCrear() {
    setCreandoRepuesto(false)
    setNombre('')
    setPartNumber('')
    setDescripcion('')
    setCompatibilidad('')
    setErrores({})
  }

  function abrirEdicion(repuesto) {
    setMensaje(null)
    setRepuestoEditando(repuesto)
    setEditNombre(repuesto.nombre || '')
    setEditPartNumber(repuesto.part_number || '')
    setEditDescripcion(repuesto.descripcion || '')
    setEditCompatibilidad(repuesto.compatibility || '')
    setEditErrores({})
  }

  function abrirDetalle(repuesto) {
    setRepuestoDetalle(repuesto)
  }

  function cerrarDetalle() {
    setRepuestoDetalle(null)
  }

  function cerrarEdicion() {
    setRepuestoEditando(null)
    setEditNombre('')
    setEditPartNumber('')
    setEditDescripcion('')
    setEditCompatibilidad('')
    setEditErrores({})
  }

  async function actualizarRepuesto() {
    if (!repuestoEditando?.id) return
    if (!validarEdicion()) return

    setGuardandoEdicion(true)

    const payload = {
      nombre: editNombre.trim(),
      part_number: editPartNumber.trim(),
      descripcion: editDescripcion.trim(),
      compatibility: editCompatibilidad.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('repuestos')
      .update(payload)
      .eq('id', repuestoEditando.id)
      .select('*')
      .single()

    setGuardandoEdicion(false)

    if (error) {
      setMensaje({
        color: 'danger',
        texto: error.code === '23505'
          ? 'Ya existe un repuesto con ese part number.'
          : error.message,
      })
      return
    }

    await db.repuestos.toCollection().modify(r => {
      if (r.idRemoto === repuestoEditando.id) {
        r.nombre = data.nombre
        r.partNumber = data.part_number
        r.descripcion = data.descripcion || ''
        r.compatibilidad = data.compatibility || ''
        r.creadoEn = data.created_at
      }
    })

    setRepuestos(prev => prev.map(r => (r.id === data.id ? data : r)))

    cerrarEdicion()
    setMensaje({ color: 'success', texto: `Repuesto ${data.nombre} actualizado correctamente.` })
  }

  async function copiarPartNumber(repuesto) {
    const texto = `${repuesto.nombre}\nPart Number: ${repuesto.part_number}`
    let ok = false

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
        ok = true
      }
    } catch {
      // fallback
    }

    if (!ok) {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = texto
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        ok = true
      } catch {
        // fallback
      }
    }

    if (ok) {
      setCopiandoId(repuesto.id || repuesto.localId)
      setTimeout(() => setCopiandoId(null), 2000)
    } else {
      setMensaje({ color: 'danger', texto: 'No se pudo copiar al portapapeles.' })
    }
  }

  async function abrirSelectorLista(repuesto) {
    setRepuestoSeleccionado(repuesto)
    setListaAgregada(null)
    setCreandoListaModal(false)
    setNombreNuevaLista('')
    setErrorNuevaLista(null)
    setCantidad(1)

    if (!userId) return

    setCargandoListasModal(true)
    try {
      const { data, error } = await supabase
        .from('spare_part_lists')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (!error) setListasDisponibles(data || [])
    } catch {
      setListasDisponibles([])
    } finally {
      setCargandoListasModal(false)
    }
  }

  function cerrarSelectorLista() {
    setRepuestoSeleccionado(null)
    setListasDisponibles([])
    setCreandoListaModal(false)
    setNombreNuevaLista('')
    setErrorNuevaLista(null)
    setListaAgregada(null)
    setCantidad(1)
  }

  async function agregarALista(listaId, qty = 1) {
    if (!userId || !repuestoSeleccionado) return

    const { error } = await supabase
      .from('spare_part_list_items')
      .insert({ list_id: listaId, spare_part_id: repuestoSeleccionado.id, quantity: qty })

    if (error && error.code !== '23505') {
      setMensaje({ color: 'danger', texto: 'No se pudo agregar el repuesto a la lista.' })
      return
    }

    await db.sparePartListItems.add({
      listId: listaId,
      sparePartId: repuestoSeleccionado.id,
      quantity: qty,
      createdAt: new Date().toISOString(),
    })

    setListaAgregada(listaId)
    setTimeout(() => cerrarSelectorLista(), 1200)
  }

  async function crearListaYAgregar() {
    if (guardandoNuevaLista) return
    setGuardandoNuevaLista(true)
    setErrorNuevaLista(null)
    try {
      const name = nombreNuevaLista.trim()
      if (!name) {
        setErrorNuevaLista('El nombre es obligatorio.')
        return
      }

      const { data, error } = await supabase
        .from('spare_part_lists')
        .insert({ user_id: userId, name })
        .select('*')
        .single()

      if (error) {
        setErrorNuevaLista(error.message)
        return
      }

      await db.sparePartLists.add({
        idRemoto: data.id,
        userId: data.user_id,
        name: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      })

      await agregarALista(data.id, cantidad)
    } finally {
      setGuardandoNuevaLista(false)
    }
  }

  const filtroNormalizado = filtroNombre.trim().toLowerCase()
  const repuestosFiltrados = filtroNormalizado
    ? repuestos.filter(r => String(r.nombre || '').toLowerCase().includes(filtroNormalizado))
    : repuestos

  return (
    <div className="space-y-5">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Inventario actualizado"
          description={mensaje.texto}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-warning-50 p-2.5 text-warning-600">
            <Boxes size={20} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-default-900 leading-tight">Repuestos</h2>
            <p className="text-sm text-default-500">
              Inventario base de repuestos técnicos
            </p>
          </div>
        </div>
        {puedeCrear && (
          <Button
            color="primary"
            radius="lg"
            startContent={<Plus size={16} />}
            onPress={abrirCrear}
            className="shrink-0 shadow-sm"
          >
            Crear repuesto
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-default-200 bg-white overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-default-900">Inventario</p>
            <Chip size="sm" variant="flat" color="warning" className="shrink-0 text-[12px] font-medium">
              {repuestosFiltrados.length} repuesto{repuestosFiltrados.length === 1 ? '' : 's'}
            </Chip>
          </div>
          <div className="mt-4">
            <Input
              label=""
              placeholder="Buscar por nombre..."
              value={filtroNombre}
              onValueChange={setFiltroNombre}
              variant="bordered"
              radius="lg"
              size="sm"
              startContent={<Search size={15} className="text-default-400" />}
              classNames={{
                inputWrapper: 'bg-default-50 border-default-200',
              }}
            />
          </div>
        </div>
        <div className="border-b border-default-100 mt-5" />

        {cargandoLista ? (
          <div className="px-5 py-4 text-sm text-default-400">Cargando repuestos...</div>
        ) : repuestos.length === 0 ? (
          <div className="px-5 py-4 text-sm text-default-400">
            Aún no hay repuestos registrados.
          </div>
        ) : repuestosFiltrados.length === 0 ? (
          <div className="px-5 py-4 text-sm text-default-400">
            No se encontraron repuestos con ese nombre.
          </div>
        ) : (
          <ScrollShadow className="max-h-[55vh] px-5 pb-5">
            <div className="space-y-3 md:hidden">
              {repuestosFiltrados.map(repuesto => (
                <RepuestoCard
                  key={repuesto.id || repuesto.localId}
                  repuesto={repuesto}
                  session={session}
                  copiandoId={copiandoId}
                  onCopy={copiarPartNumber}
                  onAddToList={abrirSelectorLista}
                  onViewDetail={abrirDetalle}
                  onEdit={puedeEditar ? abrirEdicion : null}
                />
              ))}
            </div>
            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {repuestosFiltrados.map(repuesto => (
                <RepuestoCard
                  key={repuesto.id || repuesto.localId}
                  repuesto={repuesto}
                  session={session}
                  copiandoId={copiandoId}
                  onCopy={copiarPartNumber}
                  onAddToList={abrirSelectorLista}
                  onViewDetail={abrirDetalle}
                  onEdit={puedeEditar ? abrirEdicion : null}
                />
              ))}
            </div>
          </ScrollShadow>
        )}
      </div>

      <Modal isOpen={creandoRepuesto} onOpenChange={abierto => !abierto && cerrarCrear()}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Crear repuesto</ModalHeader>
            <ModalBody className="space-y-3">
              <Input
                label="Nombre del repuesto"
                placeholder="Ej. Fuente de poder"
                value={nombre}
                onValueChange={value => {
                  setNombre(value)
                  if (errores.nombre) setErrores(prev => ({ ...prev, nombre: undefined }))
                }}
                isInvalid={Boolean(errores.nombre)}
                errorMessage={errores.nombre}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Part number"
                placeholder="Ej. NCR-00992-AX"
                value={partNumber}
                onValueChange={value => {
                  setPartNumber(value)
                  if (errores.partNumber) setErrores(prev => ({ ...prev, partNumber: undefined }))
                }}
                isInvalid={Boolean(errores.partNumber)}
                errorMessage={errores.partNumber}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Detalle"
                placeholder="Ej. Compatible con ATM SelfServ 80"
                value={descripcion}
                onValueChange={setDescripcion}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Compatibilidad"
                placeholder="Ej. NCR 6683, NCR 6625"
                value={compatibilidad}
                onValueChange={setCompatibilidad}
                variant="bordered"
                radius="lg"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={cerrarCrear}>
                Cancelar
              </Button>
              <Button color="primary" radius="lg" onPress={crearRepuesto}>
                Crear repuesto
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(repuestoDetalle)} onOpenChange={abierto => !abierto && cerrarDetalle()}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Detalle del repuesto</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                  Nombre completo
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-default-800">
                  {repuestoDetalle?.nombre || 'Sin nombre'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                    Part number
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-default-700">
                    {repuestoDetalle?.part_number || 'Sin part number'}
                  </p>
                </div>

                {repuestoDetalle?.compatibility && (
                  <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                      Compatibilidad
                    </p>
                    <p className="mt-2 text-sm text-default-700">
                      {repuestoDetalle.compatibility}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                  Detalle
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-default-700">
                  {repuestoDetalle?.descripcion || 'Sin detalle adicional'}
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" radius="lg" onPress={cerrarDetalle}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(repuestoEditando)} onOpenChange={abierto => !abierto && cerrarEdicion()}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Editar repuesto</ModalHeader>
            <ModalBody className="space-y-3">
              <Input
                label="Nombre del repuesto"
                value={editNombre}
                onValueChange={value => {
                  setEditNombre(value)
                  if (editErrores.nombre) setEditErrores(prev => ({ ...prev, nombre: undefined }))
                }}
                isInvalid={Boolean(editErrores.nombre)}
                errorMessage={editErrores.nombre}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Part number"
                value={editPartNumber}
                onValueChange={value => {
                  setEditPartNumber(value)
                  if (editErrores.partNumber) setEditErrores(prev => ({ ...prev, partNumber: undefined }))
                }}
                isInvalid={Boolean(editErrores.partNumber)}
                errorMessage={editErrores.partNumber}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Detalle"
                value={editDescripcion}
                onValueChange={setEditDescripcion}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Compatibilidad"
                placeholder="Ej. NCR 6683, NCR 6625"
                value={editCompatibilidad}
                onValueChange={setEditCompatibilidad}
                variant="bordered"
                radius="lg"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={cerrarEdicion}>
                Cancelar
              </Button>
              <Button color="primary" radius="lg" onPress={actualizarRepuesto} isLoading={guardandoEdicion}>
                Guardar cambios
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={Boolean(repuestoSeleccionado)}
        onOpenChange={abierto => !abierto && cerrarSelectorLista()}
      >
        <ModalContent>
          {creandoListaModal ? (
            <>
              <ModalHeader className="text-default-900">Crear nueva lista</ModalHeader>
              <ModalBody>
                <Input
                  label="Nombre de la lista"
                  placeholder="Ej. ATM Plaza Norte"
                  value={nombreNuevaLista}
                  onValueChange={v => {
                    setNombreNuevaLista(v)
                    if (errorNuevaLista) setErrorNuevaLista(null)
                  }}
                  isInvalid={Boolean(errorNuevaLista)}
                  errorMessage={errorNuevaLista}
                  variant="bordered"
                  radius="lg"
                  autoFocus
                />
                <Input
                  label="Cantidad"
                  type="text"
                  inputMode="numeric"
                  value={String(cantidad)}
                  onValueChange={v => {
                    if (v === '') return
                    const parsed = parseInt(v, 10)
                    if (!isNaN(parsed)) setCantidad(Math.max(1, parsed))
                  }}
                  variant="bordered"
                  radius="lg"
                  className="mt-3"
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" radius="lg" onPress={() => setCreandoListaModal(false)}>
                  Cancelar
                </Button>
                <Button color="primary" radius="lg" onPress={crearListaYAgregar} isDisabled={guardandoNuevaLista} isLoading={guardandoNuevaLista}>
                  Crear y agregar
                </Button>
              </ModalFooter>
            </>
          ) : listaAgregada ? (
            <>
              <ModalHeader className="text-default-900">Repuesto agregado</ModalHeader>
              <ModalBody>
                <div className="flex items-center gap-3 py-2">
                  <div className="rounded-full bg-success-50 p-2 text-success-600">
                    <Check size={20} />
                  </div>
                  <p className="text-sm text-default-600">
                    Repuesto agregado a la lista correctamente.
                  </p>
                </div>
              </ModalBody>
            </>
          ) : (
            <>
              <ModalHeader className="text-default-900">Agregar a lista</ModalHeader>
              <ModalBody>
                <Input
                  label="Cantidad"
                  type="text"
                  inputMode="numeric"
                  value={String(cantidad)}
                  onValueChange={v => {
                    if (v === '') return
                    const parsed = parseInt(v, 10)
                    if (!isNaN(parsed)) setCantidad(Math.max(1, parsed))
                  }}
                  variant="bordered"
                  radius="lg"
                  className="mb-3"
                />
                {cargandoListasModal ? (
                  <p className="text-sm text-default-400">Cargando listas...</p>
                ) : listasDisponibles.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-default-500">
                      No tienes listas creadas. Crea una para agregar este repuesto.
                    </p>
                    <Input
                      label="Nombre de la lista"
                      placeholder="Ej. ATM Plaza Norte"
                      value={nombreNuevaLista}
                      onValueChange={v => {
                        setNombreNuevaLista(v)
                        if (errorNuevaLista) setErrorNuevaLista(null)
                      }}
                      isInvalid={Boolean(errorNuevaLista)}
                      errorMessage={errorNuevaLista}
                      variant="bordered"
                      radius="lg"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {listasDisponibles.map(lista => (
                      <Button
                        key={lista.id}
                        variant="light"
                        radius="lg"
                        className="w-full justify-start gap-3 px-3 py-2.5 h-auto hover:bg-default-100"
                        onPress={() => agregarALista(lista.id, cantidad)}
                      >
                        <List size={16} className="shrink-0 text-default-400" />
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-default-900 truncate">
                            {lista.name}
                          </p>
                        </div>
                      </Button>
                    ))}
                    <div className="border-b border-default-100 my-2" />
                    <Button
                      variant="flat"
                      radius="lg"
                      className="w-full"
                      startContent={<Plus size={16} />}
                      onPress={() => {
                        setNombreNuevaLista('')
                        setErrorNuevaLista(null)
                        setCreandoListaModal(true)
                      }}
                    >
                      Crear nueva lista
                    </Button>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                {listasDisponibles.length === 0 ? (
                  <>
                    <Button variant="light" radius="lg" onPress={cerrarSelectorLista}>
                      Cancelar
                    </Button>
                    <Button color="primary" radius="lg" onPress={crearListaYAgregar} isDisabled={guardandoNuevaLista} isLoading={guardandoNuevaLista}>
                      Crear y agregar
                    </Button>
                  </>
                ) : (
                  <Button variant="light" radius="lg" onPress={cerrarSelectorLista} className="w-full">
                    Cancelar
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

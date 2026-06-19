import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import {
  Card, CardBody, Input, Button, Chip,
  Divider, ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@heroui/react'
import { Boxes, Eye, Plus, Copy, Check, BookmarkPlus, BookmarkCheck } from 'lucide-react'

export default function RepuestosPage() {
  const { session } = useApp()
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
  const [listaPersonal, setListaPersonal] = useState(new Set())
  const [copiandoId, setCopiandoId] = useState(null)
  const [creandoRepuesto, setCreandoRepuesto] = useState(false)

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
      })))
      setMensaje({
        color: 'warning',
        texto: 'No se pudo sincronizar con Supabase. Mostrando el inventario local disponible.',
      })
    } finally {
      setCargandoLista(false)
    }
  }

  async function cargarListaPersonal(userId) {
    try {
      const { data, error } = await supabase
        .from('user_spare_parts')
        .select('spare_part_id')
        .eq('user_id', userId)

      if (!error && data) {
        setListaPersonal(new Set(data.map(i => i.spare_part_id)))
      }
    } catch {
      // silently fail for personal list
    }
  }

  useEffect(() => {
    cargarRepuestos()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      cargarListaPersonal(session.user.id)
    } else {
      setListaPersonal(new Set())
    }
  }, [session?.user?.id])

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
      created_by: session.user.id,
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
    setMensaje({
      color: 'success',
      texto: `Repuesto ${data.nombre} agregado correctamente.`,
    })
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
    setMensaje({
      color: 'success',
      texto: `Repuesto ${data.nombre} actualizado correctamente.`,
    })
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
        // both methods failed
      }
    }

    if (ok) {
      setCopiandoId(repuesto.id || repuesto.localId)
      setTimeout(() => setCopiandoId(null), 2000)
    } else {
      setMensaje({
        color: 'danger',
        texto: 'No se pudo copiar al portapapeles.',
      })
    }
  }

  async function toggleListaPersonal(sparePartId) {
    if (!session?.user?.id) return

    if (listaPersonal.has(sparePartId)) {
      const { error } = await supabase
        .from('user_spare_parts')
        .delete()
        .eq('user_id', session.user.id)
        .eq('spare_part_id', sparePartId)

      if (error) {
        setMensaje({
          color: 'danger',
          texto: 'No se pudo quitar el repuesto de tu lista.',
        })
      } else {
        setListaPersonal(prev => {
          const next = new Set(prev)
          next.delete(sparePartId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('user_spare_parts')
        .insert({ user_id: session.user.id, spare_part_id: sparePartId })

      if (error && error.code !== '23505') {
        setMensaje({
          color: 'danger',
          texto: 'No se pudo agregar el repuesto a tu lista.',
        })
      } else {
        setListaPersonal(prev => {
          const next = new Set(prev)
          next.add(sparePartId)
          return next
        })
      }
    }
  }

  const filtroNormalizado = filtroNombre.trim().toLowerCase()
  const repuestosFiltrados = filtroNormalizado
    ? repuestos.filter(r => String(r.nombre || '').toLowerCase().includes(filtroNormalizado))
    : repuestos

  function renderCard(repuesto) {
    const key = repuesto.id || repuesto.localId
    const enLista = listaPersonal.has(repuesto.id)
    const fueCopiado = copiandoId === key

    return (
      <div
        key={key}
        className="rounded-2xl border border-default-200/70 bg-white px-4 py-4 shadow-sm transition-colors"
      >
        <p className="text-sm font-semibold text-default-900">
          {repuesto.nombre}
        </p>
        <p className="mt-1 break-all font-mono text-xs text-default-600">
          Part Number: {repuesto.part_number}
        </p>
        {repuesto.compatibility && (
          <p className="mt-2 text-xs text-default-500">
            Compatible con: {repuesto.compatibility}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            color={fueCopiado ? 'success' : 'default'}
            radius="lg"
            startContent={fueCopiado ? <Check size={14} /> : <Copy size={14} />}
            onPress={() => copiarPartNumber(repuesto)}
          >
            {fueCopiado ? 'Copiado' : 'Copiar Part Number'}
          </Button>
          <Button
            size="sm"
            variant={enLista ? 'solid' : 'flat'}
            color={enLista ? 'primary' : 'default'}
            radius="lg"
            startContent={enLista ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
            isDisabled={!session}
            onPress={() => toggleListaPersonal(repuesto.id)}
          >
            {enLista ? 'En mi lista' : 'Agregar a mi lista'}
          </Button>
        </div>
        <div className="mt-3 flex justify-end gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            aria-label={`Ver detalle del repuesto ${repuesto.nombre}`}
            onPress={() => abrirDetalle(repuesto)}
          >
            <Eye size={18} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            aria-label={`Editar repuesto ${repuesto.nombre}`}
            onPress={() => abrirEdicion(repuesto)}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">edit</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Inventario actualizado"
          description={mensaje.texto}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-warning-100 p-3 text-warning-700">
            <Boxes size={22} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-default-800">Repuestos</h2>
            <p className="text-sm text-default-500">
              Registra el inventario base con nombre y part number para tener una referencia
              inmediata dentro de la aplicación.
            </p>
          </div>
        </div>
        <Button
          color="primary"
          radius="lg"
          startContent={<Plus size={16} />}
          onPress={abrirCrear}
          className="shrink-0"
        >
          Crear repuesto
        </Button>
      </div>

      <Card shadow="sm" className="border border-default-200/70">
        <CardBody className="p-0">
          <div className="px-5 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-default-800">Inventario base</p>
                <p className="text-xs text-default-500">Los nuevos repuestos aparecen al instante.</p>
              </div>
              <Chip size="sm" variant="flat" color="warning" className="shrink-0">
                {repuestosFiltrados.length} repuesto{repuestosFiltrados.length === 1 ? '' : 's'}
              </Chip>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:max-w-[360px]">
              <Input
                label="Filtrar por nombre"
                placeholder="Busca un repuesto"
                value={filtroNombre}
                onValueChange={setFiltroNombre}
                variant="bordered"
                radius="lg"
              />
            </div>
          </div>
          <Divider className="my-4" />

          {cargandoLista ? (
            <div className="flex items-center gap-3 px-5 pb-5 text-sm text-default-500">
              Cargando repuestos...
            </div>
          ) : repuestos.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-default-400">
              Aún no hay repuestos registrados.
            </div>
          ) : repuestosFiltrados.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-default-400">
              No se encontraron repuestos con ese nombre.
            </div>
          ) : (
            <ScrollShadow className="max-h-[55vh] px-5 pb-5">
              <div className="space-y-3 md:hidden">
                {repuestosFiltrados.map(renderCard)}
              </div>
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {repuestosFiltrados.map(renderCard)}
              </div>
            </ScrollShadow>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={creandoRepuesto} onOpenChange={abierto => !abierto && cerrarCrear()}>
        <ModalContent>
          <>
            <ModalHeader>Crear repuesto</ModalHeader>
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
              <Button variant="light" onPress={cerrarCrear}>
                Cancelar
              </Button>
              <Button color="primary" onPress={crearRepuesto}>
                Crear repuesto
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(repuestoDetalle)} onOpenChange={abierto => !abierto && cerrarDetalle()}>
        <ModalContent>
          <>
            <ModalHeader>Detalle del repuesto</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                  Nombre completo
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-default-800">
                  {repuestoDetalle?.nombre || 'Sin nombre'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                    Part number
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-default-700">
                    {repuestoDetalle?.part_number || 'Sin part number'}
                  </p>
                </div>

                {repuestoDetalle?.compatibility && (
                  <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                      Compatibilidad
                    </p>
                    <p className="mt-2 text-sm text-default-700">
                      {repuestoDetalle.compatibility}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                  Detalle
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-default-700">
                  {repuestoDetalle?.descripcion || 'Sin detalle adicional'}
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={cerrarDetalle}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(repuestoEditando)} onOpenChange={abierto => !abierto && cerrarEdicion()}>
        <ModalContent>
          <>
            <ModalHeader>Editar repuesto</ModalHeader>
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
              <Button variant="light" onPress={cerrarEdicion}>
                Cancelar
              </Button>
              <Button color="primary" onPress={actualizarRepuesto} isLoading={guardandoEdicion}>
                Guardar cambios
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

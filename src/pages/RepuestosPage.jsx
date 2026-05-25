import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import {
  Card, CardBody, Input, Button, Chip,
  Divider, ScrollShadow, Alert as HeroAlert,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@heroui/react'
import { Boxes, Eye, Plus } from 'lucide-react'

export default function RepuestosPage() {
  const { session } = useApp()
  const [repuestos, setRepuestos] = useState([])
  const [nombre, setNombre] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tieneStock, setTieneStock] = useState(false)
  const [filtroNombre, setFiltroNombre] = useState('')
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [repuestoDetalle, setRepuestoDetalle] = useState(null)
  const [repuestoEditando, setRepuestoEditando] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editTieneStock, setEditTieneStock] = useState(false)
  const [editErrores, setEditErrores] = useState({})
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  useEffect(() => {
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
          await db.repuestos.bulkAdd(data.map(repuesto => ({
            idRemoto: repuesto.id,
            nombre: repuesto.nombre,
            partNumber: repuesto.part_number,
            descripcion: repuesto.descripcion || '',
            tieneStock: Boolean(repuesto.tiene_stock),
            creadoEn: repuesto.created_at,
          })))
        }
      } catch {
      const local = await db.repuestos.orderBy('localId').reverse().toArray()
        setRepuestos(local.map(repuesto => ({
          id: repuesto.idRemoto || repuesto.localId,
          nombre: repuesto.nombre,
          part_number: repuesto.partNumber,
          descripcion: repuesto.descripcion || '',
          tiene_stock: Boolean(repuesto.tieneStock),
        })))
        setMensaje({
          color: 'warning',
          texto: 'No se pudo sincronizar con Supabase. Mostrando el inventario local disponible.',
        })
      } finally {
        setCargandoLista(false)
      }
    }

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
      tiene_stock: tieneStock,
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
      creadoEn: data.created_at,
    })

    setRepuestos(prev => [data, ...prev])
    setNombre('')
    setPartNumber('')
    setDescripcion('')
    setTieneStock(false)
    setErrores({})
    setMensaje({
      color: 'success',
      texto: `Repuesto ${data.nombre} agregado correctamente.`,
    })
  }

  function abrirEdicion(repuesto) {
    setMensaje(null)
    setRepuestoEditando(repuesto)
    setEditNombre(repuesto.nombre || '')
    setEditPartNumber(repuesto.part_number || '')
    setEditDescripcion(repuesto.descripcion || '')
    setEditTieneStock(Boolean(repuesto.tiene_stock))
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
    setEditTieneStock(false)
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
      tiene_stock: editTieneStock,
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

    await db.repuestos.toCollection().modify(repuesto => {
      if (repuesto.idRemoto === repuestoEditando.id) {
        repuesto.nombre = data.nombre
        repuesto.partNumber = data.part_number
        repuesto.descripcion = data.descripcion || ''
        repuesto.tieneStock = Boolean(data.tiene_stock)
        repuesto.creadoEn = data.created_at
      }
    })

    setRepuestos(prev => prev.map(repuesto => (
      repuesto.id === data.id ? data : repuesto
    )))

    cerrarEdicion()
    setMensaje({
      color: 'success',
      texto: `Repuesto ${data.nombre} actualizado correctamente.`,
    })
  }

  const filtroNormalizado = filtroNombre.trim().toLowerCase()
  const repuestosFiltrados = filtroNormalizado
    ? repuestos.filter(repuesto => String(repuesto.nombre || '').toLowerCase().includes(filtroNormalizado))
    : repuestos

  return (
    <div className="space-y-4">
      <Card shadow="sm" className="border border-default-200/70">
        <CardBody className="p-6 md:p-8 space-y-5">
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

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Nombre del repuesto"
              placeholder="Ej. Fuente de poder"
              value={nombre}
              onValueChange={value => {
                setNombre(value)
                if (errores.nombre) {
                  setErrores(prev => ({ ...prev, nombre: undefined }))
                }
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
                if (errores.partNumber) {
                  setErrores(prev => ({ ...prev, partNumber: undefined }))
                }
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
          </div>

          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-sm font-semibold text-default-700">Stock actual</p>
            <p className="mt-1 text-xs text-default-500">
              Indica si este repuesto está disponible actualmente.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                radius="lg"
                color={tieneStock ? 'success' : 'default'}
                variant={tieneStock ? 'solid' : 'bordered'}
                onPress={() => setTieneStock(true)}
              >
                Con stock
              </Button>
              <Button
                size="sm"
                radius="lg"
                color={!tieneStock ? 'danger' : 'default'}
                variant={!tieneStock ? 'solid' : 'bordered'}
                onPress={() => setTieneStock(false)}
              >
                Sin stock
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              color="primary"
              radius="lg"
              startContent={<Plus size={16} />}
              onPress={crearRepuesto}
            >
              Crear repuesto
            </Button>
          </div>

          {mensaje && (
            <HeroAlert
              color={mensaje.color}
              title="Inventario actualizado"
              description={mensaje.texto}
            />
          )}
        </CardBody>
      </Card>

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
                {repuestosFiltrados.map(repuesto => (
                  <div
                    key={repuesto.id || repuesto.localId}
                    className={`rounded-2xl border px-4 py-4 shadow-sm transition-colors ${
                      repuesto.tiene_stock
                        ? 'border-success-200 bg-success-50/80'
                        : 'border-danger-200 bg-danger-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${
                          repuesto.tiene_stock ? 'text-success-950' : 'text-danger-950'
                        }`}>
                          {repuesto.nombre}
                        </p>
                        <p className={`mt-1 break-all font-mono text-xs ${
                          repuesto.tiene_stock ? 'text-success-800' : 'text-danger-800'
                        }`}>
                          {repuesto.part_number}
                        </p>
                      </div>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={repuesto.tiene_stock ? 'success' : 'danger'}
                      >
                        {repuesto.tiene_stock ? 'Con stock' : 'Sin stock'}
                      </Chip>
                    </div>

                    <div className="mt-4 rounded-xl bg-white/70 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                        Detalle
                      </p>
                      <p className="mt-1 text-sm leading-5 text-default-700">
                        {repuesto.descripcion || 'Sin detalle adicional'}
                      </p>
                    </div>

                    <div className="mt-4 flex justify-end">
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
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-default-200 bg-white md:block">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_100px_minmax(0,1.1fr)_136px] gap-4 border-b border-default-200 bg-default-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-500">
                  <span>Nombre</span>
                  <span>Part Number</span>
                  <span>Stock</span>
                  <span>Detalle</span>
                  <span className="text-right">Acción</span>
                </div>
                <div className="divide-y divide-default-100">
                  {repuestosFiltrados.map(repuesto => (
                    <div
                      key={repuesto.id || repuesto.localId}
                      className={`grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_100px_minmax(0,1.1fr)_136px] gap-4 px-4 py-3 transition-colors ${
                        repuesto.tiene_stock
                          ? 'bg-success-50/70 hover:bg-success-50'
                          : 'bg-danger-50/70 hover:bg-danger-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${
                          repuesto.tiene_stock ? 'text-success-900' : 'text-danger-900'
                        }`}>
                          {repuesto.nombre}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate font-mono text-sm ${
                          repuesto.tiene_stock ? 'text-success-800' : 'text-danger-800'
                        }`}>
                          {repuesto.part_number}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={repuesto.tiene_stock ? 'success' : 'danger'}
                        >
                          {repuesto.tiene_stock ? 'Disponible' : 'Sin stock'}
                        </Chip>
                      </div>
                      <div className="min-w-0">
                        <p className={`line-clamp-2 text-xs leading-5 ${
                          repuesto.tiene_stock ? 'text-success-700' : 'text-danger-700'
                        }`}>
                          {repuesto.descripcion || 'Sin detalle adicional'}
                        </p>
                      </div>
                      <div className="flex justify-end gap-1">
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
                  ))}
                </div>
              </div>
            </ScrollShadow>
          )}
        </CardBody>
      </Card>

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

                <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                    Estado
                  </p>
                  <div className="mt-2">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={repuestoDetalle?.tiene_stock ? 'success' : 'danger'}
                    >
                      {repuestoDetalle?.tiene_stock ? 'Con stock' : 'Sin stock'}
                    </Chip>
                  </div>
                </div>
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
              <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <p className="text-sm font-semibold text-default-700">Stock actual</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    radius="lg"
                    color={editTieneStock ? 'success' : 'default'}
                    variant={editTieneStock ? 'solid' : 'bordered'}
                    onPress={() => setEditTieneStock(true)}
                  >
                    Con stock
                  </Button>
                  <Button
                    size="sm"
                    radius="lg"
                    color={!editTieneStock ? 'danger' : 'default'}
                    variant={!editTieneStock ? 'solid' : 'bordered'}
                    onPress={() => setEditTieneStock(false)}
                  >
                    Sin stock
                  </Button>
                </div>
              </div>
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

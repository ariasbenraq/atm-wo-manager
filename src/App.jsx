import { useCallback, useEffect, useState } from 'react'
import { syncFromSupabase } from './lib/sync'
import { db } from './lib/db'
import { supabase } from './lib/supabase'
import ImportarExcel from './components/ImportarExcel'
import ListaTareas from './components/ListaTareas'
import FormularioCierre from './components/FormularioCierre'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Chip,
  Card,
  CardBody,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Divider,
  Input,
  Alert as HeroAlert,
  ScrollShadow,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react'
import MuiAlert from '@mui/material/Alert'
import Fade from '@mui/material/Fade'
import { Boxes, ClipboardList, Eye, LogOut, Menu, Package, Plus, Wrench } from 'lucide-react'

const VISTA_INICIAL = 'tareas'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList },
  { key: 'mis-tareas', label: 'Mis tareas', icon: Wrench },
  { key: 'repuestos', label: 'Repuestos', icon: Package },
]

function obtenerMarcaTiempoProgramada(tarea) {
  const fecha = String(tarea?.fecha || '').trim()
  const hora = String(tarea?.hora || '').trim() || '00:00'

  if (!fecha) return 0

  const matchIso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matchIso) return 0

  const [, year, month, day] = matchIso
  const marca = new Date(`${year}-${month}-${day}T${hora.length === 5 ? `${hora}:00` : hora}`)
  return Number.isNaN(marca.getTime()) ? 0 : marca.getTime()
}

function obtenerProximaTareaEnVentana(tareas, ahoraMs) {
  const limite = ahoraMs + (60 * 60 * 1000)

  return tareas
    .filter(tarea => tarea?.estado !== 'completada')
    .map(tarea => ({ tarea, marca: obtenerMarcaTiempoProgramada(tarea) }))
    .filter(item => item.marca >= ahoraMs && item.marca <= limite)
    .sort((a, b) => a.marca - b.marca)[0] || null
}

function formatearTiempoRestante(ms) {
  const minutos = Math.max(0, Math.ceil(ms / 60000))
  if (minutos <= 1) return 'en menos de 1 min'
  if (minutos < 60) return `en ${minutos} min`
  return 'en 1 hora'
}

function PaginaLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  function validarFormulario() {
    const nuevosErrores = {}

    if (!email.trim()) nuevosErrores.email = 'El correo es obligatorio.'
    if (!password.trim()) nuevosErrores.password = 'La contraseña es obligatoria.'

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function iniciarSesion() {
    setMensaje(null)

    if (!validarFormulario()) return

    setCargando(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setCargando(false)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    onLogin?.(data.session ?? null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-default-100 via-default-50 to-white px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card shadow="sm" className="border border-default-200/70 bg-white/90">
          <CardBody className="space-y-5 p-6">
            <div className="space-y-2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-default-400">ATM·WO</p>
              <h1 className="text-xl font-semibold text-default-800">Acceso técnico</h1>
              <p className="text-sm text-default-500">
                Inicia sesión con tu cuenta para registrar y consultar repuestos en Supabase.
              </p>
            </div>

            <Input
              label="Correo"
              type="email"
              placeholder="tecnico@ncr.com"
              value={email}
              onValueChange={value => {
                setEmail(value)
                if (errores.email) setErrores(prev => ({ ...prev, email: undefined }))
              }}
              isInvalid={Boolean(errores.email)}
              errorMessage={errores.email}
              variant="bordered"
              radius="lg"
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onValueChange={value => {
                setPassword(value)
                if (errores.password) setErrores(prev => ({ ...prev, password: undefined }))
              }}
              isInvalid={Boolean(errores.password)}
              errorMessage={errores.password}
              variant="bordered"
              radius="lg"
            />

            <Button color="primary" radius="lg" onPress={iniciarSesion} isLoading={cargando}>
              Entrar
            </Button>

            {mensaje && (
              <HeroAlert
                color={mensaje.color}
                title="No se pudo iniciar sesión"
                description={mensaje.texto}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function PaginaRepuestos({ session }) {
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
              <Spinner size="sm" />
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

export default function App() {
  const [tareas, setTareas] = useState([])
  const [misTareas, setMisTareas] = useState([])
  const [syncing, setSyncing] = useState(true)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  const [indiceAlertaProximaTarea, setIndiceAlertaProximaTarea] = useState(0)
  const [vista, setVista] = useState(() => {
    if (typeof window === 'undefined') return VISTA_INICIAL
    return sessionStorage.getItem('atm-wo-vista') || VISTA_INICIAL
  })

  async function cargarTareas() {
    const local = await db.tareas.toArray()
    setTareas(local)
  }

  async function cargarMisTareas() {
    const local = await db.mis_tareas.toArray()
    setMisTareas(local)
  }

  function construirPayloadMisTarea(tarea, userId) {
    return {
      user_id: userId,
      tarea_wo: tarea.wo,
      estado: tarea.estado || 'pendiente',
      completada_at: tarea.completadaEn || null,
      ds: tarea.ds || null,
      arribo: tarea.arribo || null,
      inicio: tarea.inicio || null,
      fin: tarea.fin || null,
      retorno: tarea.retorno || null,
      tiempos_updated_at: tarea.tiemposUpdatedAt || null,
    }
  }

  async function marcarTiemposSincronizados(wo, tiemposSyncPendiente) {
    await db.mis_tareas.where('wo').equals(wo).modify({ tiemposSyncPendiente })
    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo
        ? { ...tarea, tiemposSyncPendiente }
        : tarea
    )))
  }

  const sincronizarTiemposPendientes = useCallback(async (userId) => {
    if (!userId) return

    const pendientes = await db.mis_tareas
      .filter(tarea => Boolean(tarea.tiemposSyncPendiente))
      .toArray()

    for (const tarea of pendientes) {
      try {
        const { error } = await supabase
          .from('mis_tareas')
          .upsert(construirPayloadMisTarea(tarea, userId), {
            onConflict: 'user_id,tarea_wo',
          })

        if (error) throw error
        await marcarTiemposSincronizados(tarea.wo, false)
      } catch (error) {
        console.warn(`No se pudo sincronizar los tiempos de la tarea ${tarea.wo}.`, error)
      }
    }
  }, [])

  async function agregarAMisTareas(tarea) {
    if (!tarea?.wo) return

    const existente = await db.mis_tareas.where('wo').equals(tarea.wo).first()
    if (existente) return

    const tareaPendiente = {
      ...tarea,
      estado: 'pendiente',
      completadaEn: null,
      ds: null,
      arribo: null,
      inicio: null,
      fin: null,
      retorno: null,
      tiemposUpdatedAt: null,
      tiemposSyncPendiente: false,
    }

    await db.mis_tareas.add(tareaPendiente)
    setMisTareas(prev => [tareaPendiente, ...prev])

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .upsert(construirPayloadMisTarea(tareaPendiente, session.user.id), {
          onConflict: 'user_id,tarea_wo',
        })

      if (error && error.code !== '23505') {
        throw error
      }
    } catch (error) {
      console.warn('No se pudo guardar la tarea en Supabase.', error)
    }
  }

  async function marcarTareaCompletada(wo) {
    if (!wo) return

    const completadaEn = new Date().toISOString()

    await db.mis_tareas.where('wo').equals(wo).modify({
      estado: 'completada',
      completadaEn,
    })

    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo
        ? { ...tarea, estado: 'completada', completadaEn }
        : tarea
    )))

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .update({
          estado: 'completada',
          completada_at: completadaEn,
        })
        .eq('user_id', session.user.id)
        .eq('tarea_wo', wo)

      if (error) throw error
    } catch (error) {
      console.warn('No se pudo actualizar la tarea en Supabase.', error)
    }
  }

  async function eliminarDeMisTareas(wo) {
    if (!wo) return

    await db.mis_tareas.where('wo').equals(wo).delete()
    setMisTareas(prev => prev.filter(tarea => tarea.wo !== wo))

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .delete()
        .eq('user_id', session.user.id)
        .eq('tarea_wo', wo)

      if (error) throw error
    } catch (error) {
      console.warn('No se pudo eliminar la tarea en Supabase.', error)
    }
  }

  async function guardarTiemposMisTarea(wo, cambios) {
    if (!wo) return

    const tareaActual = await db.mis_tareas.where('wo').equals(wo).first()
    if (!tareaActual) return

    const tiemposUpdatedAt = new Date().toISOString()
    const tareaActualizada = {
      ...tareaActual,
      ...cambios,
      tiemposUpdatedAt,
      tiemposSyncPendiente: true,
    }

    await db.mis_tareas.where('wo').equals(wo).modify({
      ...cambios,
      tiemposUpdatedAt,
      tiemposSyncPendiente: true,
    })

    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo
        ? { ...tarea, ...cambios, tiemposUpdatedAt, tiemposSyncPendiente: true }
        : tarea
    )))

    if (!session?.user?.id) return

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .upsert(construirPayloadMisTarea(tareaActualizada, session.user.id), {
          onConflict: 'user_id,tarea_wo',
        })

      if (error) throw error
      await marcarTiemposSincronizados(wo, false)
    } catch (error) {
      console.warn(`No se pudo guardar en Supabase los tiempos de la tarea ${wo}.`, error)
    }
  }

  useEffect(() => {
    let activo = true

    async function initAuth() {
      const { data } = await supabase.auth.getSession()
      if (!activo) return
      setSession(data.session ?? null)
      setAuthLoading(false)
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      if (!activo) return
      setSession(nuevaSession ?? null)
    })

    return () => {
      activo = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function init() {
      setSyncing(true)
      await cargarTareas()
      await cargarMisTareas()
      await syncFromSupabase(session.user.id)
      await sincronizarTiemposPendientes(session.user.id)
      await syncFromSupabase(session.user.id)
      await cargarTareas()
      await cargarMisTareas()
      setSyncing(false)
    }

    if (session) {
      init()
    } else {
      setSyncing(false)
    }
  }, [session, sincronizarTiemposPendientes])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('atm-wo-vista', vista)
  }, [vista])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAhoraMs(Date.now())
    }, 30000)

    return () => window.clearInterval(timer)
  }, [])

  const proximaTarea = obtenerProximaTareaEnVentana(misTareas, ahoraMs)
  const detallesAlerta = proximaTarea
    ? [
      { etiqueta: 'Agencia', valor: proximaTarea.tarea.nombre || 'Sin agencia' },
      { etiqueta: 'ID ATM', valor: proximaTarea.tarea.id_atm || 'Sin ID ATM' },
      { etiqueta: 'Dirección', valor: proximaTarea.tarea.direccion || 'Sin dirección' },
    ]
    : []
  const proximaTareaWo = proximaTarea?.tarea?.wo || null
  const totalDetallesAlerta = detallesAlerta.length
  const detalleActivoAlerta = detallesAlerta[indiceAlertaProximaTarea % (detallesAlerta.length || 1)] || null
  const tiempoRestanteProximaTarea = proximaTarea
    ? formatearTiempoRestante(proximaTarea.marca - ahoraMs)
    : ''

  useEffect(() => {
    setIndiceAlertaProximaTarea(0)
  }, [proximaTareaWo])

  useEffect(() => {
    if (!proximaTareaWo || totalDetallesAlerta <= 1) return

    const timer = window.setInterval(() => {
      setIndiceAlertaProximaTarea(prev => (prev + 1) % totalDetallesAlerta)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [proximaTareaWo, totalDetallesAlerta])

  const vistaActiva = vistas.find(item => item.key === vista) || vistas[0]
  const VistaIcono = vistaActiva.icon

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setSession(null)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-default-100 via-default-50 to-white">
        <div className="flex items-center gap-3 text-sm text-default-500">
          <Spinner size="sm" />
          Verificando sesión...
        </div>
      </div>
    )
  }

  if (!session) {
    return <PaginaLogin onLogin={setSession} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-default-100 via-default-50 to-white">
      <Navbar isBordered maxWidth="md" className="bg-white/85 backdrop-blur-md">
        <NavbarBrand>
          <p className="font-bold text-inherit tracking-tight font-mono">ATM·WO</p>
        </NavbarBrand>
        <NavbarContent justify="center" className="flex-1 px-2">
          <Fade in={Boolean(proximaTarea && detalleActivoAlerta)} timeout={350} key={`${proximaTarea?.tarea?.wo || 'sin-tarea'}-${indiceAlertaProximaTarea}`}>
            <div className="w-full max-w-md">
              {proximaTarea && detalleActivoAlerta ? (
                <MuiAlert
                  severity="info"
                  variant="filled"
                  icon={false}
                  sx={{
                    width: '100%',
                    borderRadius: '16px',
                    py: 0.75,
                    px: 1.5,
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #0f766e, #0ea5e9)',
                    boxShadow: '0 14px 30px rgba(14, 116, 144, 0.22)',
                    '& .MuiAlert-message': {
                      width: '100%',
                      overflow: 'hidden',
                    },
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      Se acerca la próxima tarea {tiempoRestanteProximaTarea}
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {detalleActivoAlerta.etiqueta}: {detalleActivoAlerta.valor}
                    </p>
                  </div>
                </MuiAlert>
              ) : <div />}
            </div>
          </Fade>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <Chip size="sm" variant="flat" color={syncing ? 'warning' : 'success'}>
              {syncing ? 'Sincronizando...' : `${tareas.length} tareas`}
            </Chip>
          </NavbarItem>
          <NavbarItem>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant="light"
                  radius="full"
                  aria-label="Abrir menú de navegación"
                >
                  <Menu size={20} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Menú de navegación"
                selectedKeys={[vista]}
                selectionMode="single"
                onAction={key => {
                  if (String(key) === 'salir') {
                    cerrarSesion()
                    return
                  }

                  setVista(String(key))
                }}
              >
                {vistas.map(item => {
                  const Icon = item.icon
                  return (
                    <DropdownItem
                      key={item.key}
                      startContent={<Icon size={16} />}
                      description={item.key === vista ? 'Vista actual' : undefined}
                    >
                      {item.label}
                    </DropdownItem>
                  )
                })}
                <DropdownItem
                  key="salir"
                  color="danger"
                  startContent={<LogOut size={16} />}
                >
                  Salir
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 md:space-y-5 pb-10">
        <Card shadow="none" className="border border-default-200/70 rounded-2xl bg-white/80 backdrop-blur-sm">
          <CardBody className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-100 p-2.5 text-primary">
                  <VistaIcono size={18} />
                </div>
                <div>
                  <p className="text-sm text-default-500">Navegación</p>
                  <h1 className="text-lg font-semibold text-default-800">{vistaActiva.label}</h1>
                </div>
              </div>
              <Chip size="sm" variant="flat" color="primary">
                Menú
              </Chip>
            </div>
            <Divider className="my-4" />
            <p className="text-sm text-default-500">
              Usa el botón hamburguesa para moverte entre páginas sin recargar la aplicación.
            </p>
          </CardBody>
        </Card>

        <div className={vista === 'tareas' ? 'block space-y-4' : 'hidden'}>
          <ImportarExcel onImportado={cargarTareas} />
          <ListaTareas
            tareas={tareas}
            misTareas={misTareas}
            onAgregarAMisTareas={agregarAMisTareas}
          />
        </div>

        <div className={vista === 'mis-tareas' ? 'block' : 'hidden'}>
          <FormularioCierre
            tareas={misTareas}
            onMarcarCompletada={marcarTareaCompletada}
            onEliminarTarea={eliminarDeMisTareas}
            onGuardarTiempos={guardarTiemposMisTarea}
          />
        </div>

        <div className={vista === 'repuestos' ? 'block' : 'hidden'}>
          <PaginaRepuestos session={session} />
        </div>
      </main>
    </div>
  )
}

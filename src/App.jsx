import { useEffect, useRef, useState } from 'react'
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
  Alert,
  ScrollShadow,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react'
import { Boxes, ClipboardList, LogOut, Menu, Package, Plus, Wrench } from 'lucide-react'

const VISTA_INICIAL = 'tareas'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList },
  { key: 'mis-tareas', label: 'Mis tareas', icon: Wrench },
  { key: 'repuestos', label: 'Repuestos', icon: Package },
]

function construirRutaImagen(userId, fileName) {
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg'
  const nombreBase = fileName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'repuesto'

  return `${userId}/${Date.now()}-${nombreBase}.${extension}`
}

async function subirImagenRepuesto(file, userId) {
  const ruta = construirRutaImagen(userId, file.name)
  const { error } = await supabase.storage
    .from('repuestos')
    .upload(ruta, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  const { data } = supabase.storage.from('repuestos').getPublicUrl(ruta)
  return data.publicUrl
}

function MiniaturaRepuesto({ nombre, imagenUrl, className = 'h-14 w-14' }) {
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    setErrorCarga(false)
  }, [imagenUrl])

  if (!imagenUrl || errorCarga) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-xl border border-dashed border-default-300 bg-default-100 text-[10px] font-medium uppercase tracking-[0.16em] text-default-500`}>
        Sin imagen
      </div>
    )
  }

  return (
    <img
      src={imagenUrl}
      alt={`Referencia de ${nombre}`}
      className={`${className} shrink-0 rounded-xl border border-default-200 bg-white object-cover`}
      loading="lazy"
      onError={() => setErrorCarga(true)}
    />
  )
}

function obtenerImagenRepuesto(repuesto) {
  return String(repuesto?.image_url || repuesto?.imagen_url || repuesto?.imagenUrl || '').trim()
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
              <Alert
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
  const inputImagenRef = useRef(null)
  const inputEditImagenRef = useRef(null)
  const [repuestos, setRepuestos] = useState([])
  const [nombre, setNombre] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [imagenArchivo, setImagenArchivo] = useState(null)
  const [imagenPreview, setImagenPreview] = useState('')
  const [tieneStock, setTieneStock] = useState(false)
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [creandoRepuesto, setCreandoRepuesto] = useState(false)
  const [repuestoEditando, setRepuestoEditando] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editImagenArchivo, setEditImagenArchivo] = useState(null)
  const [editImagenPreview, setEditImagenPreview] = useState('')
  const [editTieneStock, setEditTieneStock] = useState(false)
  const [editErrores, setEditErrores] = useState({})
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  useEffect(() => {
    if (!imagenArchivo) {
      setImagenPreview('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(imagenArchivo)
    setImagenPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [imagenArchivo])

  useEffect(() => {
    if (!editImagenArchivo) {
      return undefined
    }

    const objectUrl = URL.createObjectURL(editImagenArchivo)
    setEditImagenPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [editImagenArchivo])

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
            imagenUrl: obtenerImagenRepuesto(repuesto),
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
          imagen_url: obtenerImagenRepuesto(repuesto),
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

    if (imagenArchivo && !imagenArchivo.type.startsWith('image/')) {
      nuevosErrores.imagen = 'Selecciona un archivo de imagen valido.'
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

    if (editImagenArchivo && !editImagenArchivo.type.startsWith('image/')) {
      nuevosErrores.imagen = 'Selecciona un archivo de imagen valido.'
    }

    setEditErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function crearRepuesto() {
    setMensaje(null)

    if (!validarFormulario()) return

    setCreandoRepuesto(true)

    let imageUrl = null

    try {
      if (imagenArchivo) {
        imageUrl = await subirImagenRepuesto(imagenArchivo, session.user.id)
      }
    } catch (error) {
      setCreandoRepuesto(false)
      setMensaje({
        color: 'danger',
        texto: `No se pudo subir la imagen: ${error.message}`,
      })
      return
    }

    const payload = {
      nombre: nombre.trim(),
      part_number: partNumber.trim(),
      descripcion: descripcion.trim(),
      tiene_stock: tieneStock,
      image_url: imageUrl,
      created_by: session.user.id,
    }

    const { data, error } = await supabase
      .from('repuestos')
      .insert(payload)
      .select('*')
      .single()

    setCreandoRepuesto(false)

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
      imagenUrl: obtenerImagenRepuesto(data),
      tieneStock: Boolean(data.tiene_stock),
      creadoEn: data.created_at,
    })

    setRepuestos(prev => [data, ...prev])
    setNombre('')
    setPartNumber('')
    setDescripcion('')
    setImagenArchivo(null)
    setImagenPreview('')
    if (inputImagenRef.current) inputImagenRef.current.value = ''
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
    setEditImagenArchivo(null)
    setEditImagenPreview(obtenerImagenRepuesto(repuesto))
    setEditTieneStock(Boolean(repuesto.tiene_stock))
    setEditErrores({})
    if (inputEditImagenRef.current) inputEditImagenRef.current.value = ''
  }

  function cerrarEdicion() {
    setRepuestoEditando(null)
    setEditNombre('')
    setEditPartNumber('')
    setEditDescripcion('')
    setEditImagenArchivo(null)
    setEditImagenPreview('')
    setEditTieneStock(false)
    setEditErrores({})
    if (inputEditImagenRef.current) inputEditImagenRef.current.value = ''
  }

  async function actualizarRepuesto() {
    if (!repuestoEditando?.id) return
    if (!validarEdicion()) return

    setGuardandoEdicion(true)

    let imageUrl = obtenerImagenRepuesto(repuestoEditando) || null

    try {
      if (editImagenArchivo) {
        imageUrl = await subirImagenRepuesto(editImagenArchivo, session.user.id)
      }
    } catch (error) {
      setGuardandoEdicion(false)
      setMensaje({
        color: 'danger',
        texto: `No se pudo subir la imagen: ${error.message}`,
      })
      return
    }

    const payload = {
      nombre: editNombre.trim(),
      part_number: editPartNumber.trim(),
      descripcion: editDescripcion.trim(),
      image_url: imageUrl,
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
        repuesto.imagenUrl = obtenerImagenRepuesto(data)
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={inputImagenRef}
              onChange={event => {
                const file = event.target.files?.[0] || null
                setImagenArchivo(file)
                if (errores.imagen) {
                  setErrores(prev => ({ ...prev, imagen: undefined }))
                }
              }}
            />
          </div>

          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <div className="flex items-start gap-4">
              <MiniaturaRepuesto nombre={nombre || 'Nuevo repuesto'} imagenUrl={imagenPreview} className="h-16 w-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-default-700">Imagen de referencia</p>
                <p className="text-xs text-default-500">
                  Selecciona una imagen para subirla al bucket `repuestos` de Supabase Storage.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="bordered" radius="lg" onPress={() => inputImagenRef.current?.click()}>
                    Seleccionar imagen
                  </Button>
                  {imagenArchivo && (
                    <Button
                      variant="light"
                      radius="lg"
                      onPress={() => {
                        setImagenArchivo(null)
                        setImagenPreview('')
                        if (inputImagenRef.current) inputImagenRef.current.value = ''
                      }}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-default-500">
                  {imagenArchivo ? imagenArchivo.name : 'Aun no seleccionaste una imagen.'}
                </p>
                {errores.imagen && (
                  <p className="text-xs text-danger-500">{errores.imagen}</p>
                )}
              </div>
            </div>
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
              isLoading={creandoRepuesto}
            >
              Crear repuesto
            </Button>
          </div>

          {mensaje && (
            <Alert
              color={mensaje.color}
              title="Inventario actualizado"
              description={mensaje.texto}
            />
          )}
        </CardBody>
      </Card>

      <Card shadow="sm" className="border border-default-200/70">
        <CardBody className="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <p className="text-sm font-semibold text-default-800">Inventario base</p>
              <p className="text-xs text-default-500">Los nuevos repuestos aparecen al instante.</p>
            </div>
            <Chip size="sm" variant="flat" color="warning">
              {repuestos.length} repuesto{repuestos.length === 1 ? '' : 's'}
            </Chip>
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
          ) : (
            <ScrollShadow className="max-h-[55vh] px-5 pb-5">
              <div className="space-y-3 md:hidden">
                {repuestos.map(repuesto => (
                  <div
                    key={repuesto.id || repuesto.localId}
                    className={`rounded-2xl border px-4 py-4 shadow-sm transition-colors ${
                      repuesto.tiene_stock
                        ? 'border-success-200 bg-success-50/80'
                        : 'border-danger-200 bg-danger-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="relative">
                          <MiniaturaRepuesto nombre={repuesto.nombre} imagenUrl={obtenerImagenRepuesto(repuesto)} />
                        </div>
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
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_100px_minmax(0,1.1fr)_96px] gap-4 border-b border-default-200 bg-default-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-500">
                  <span>Nombre</span>
                  <span>Part Number</span>
                  <span>Stock</span>
                  <span>Detalle</span>
                  <span className="text-right">Acción</span>
                </div>
                <div className="divide-y divide-default-100">
                  {repuestos.map(repuesto => (
                    <div
                      key={repuesto.id || repuesto.localId}
                      className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_100px_minmax(0,1.1fr)_96px] gap-4 px-4 py-3 transition-colors ${
                        repuesto.tiene_stock
                          ? 'bg-success-50/70 hover:bg-success-50'
                          : 'bg-danger-50/70 hover:bg-danger-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <MiniaturaRepuesto nombre={repuesto.nombre} imagenUrl={obtenerImagenRepuesto(repuesto)} className="h-12 w-12" />
                        </div>
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
                      <div className="flex justify-end">
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
              <input
                ref={inputEditImagenRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0] || null
                  setEditImagenArchivo(file)
                  if (editErrores.imagen) {
                    setEditErrores(prev => ({ ...prev, imagen: undefined }))
                  }
                }}
              />
              <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <div className="flex items-start gap-4">
                  <MiniaturaRepuesto nombre={editNombre || 'Repuesto'} imagenUrl={editImagenPreview} className="h-16 w-16" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-semibold text-default-700">Imagen actual</p>
                    <p className="text-xs text-default-500">
                      Puedes reemplazar la imagen subiendo un nuevo archivo al bucket `repuestos`.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="bordered" radius="lg" onPress={() => inputEditImagenRef.current?.click()}>
                        Reemplazar imagen
                      </Button>
                      {editImagenArchivo && (
                        <Button
                          variant="light"
                          radius="lg"
                          onPress={() => {
                            setEditImagenArchivo(null)
                            setEditImagenPreview(obtenerImagenRepuesto(repuestoEditando))
                            if (inputEditImagenRef.current) inputEditImagenRef.current.value = ''
                          }}
                        >
                          Cancelar cambio
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-default-500">
                      {editImagenArchivo ? editImagenArchivo.name : 'Se mantendra la imagen actual si no subes otra.'}
                    </p>
                    {editErrores.imagen && (
                      <p className="text-xs text-danger-500">{editErrores.imagen}</p>
                    )}
                  </div>
                </div>
              </div>
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

  async function agregarAMisTareas(tarea) {
    if (!tarea?.wo) return

    const existente = await db.mis_tareas.where('wo').equals(tarea.wo).first()
    if (existente) return

    const tareaPendiente = {
      ...tarea,
      estado: 'pendiente',
      completadaEn: null,
    }

    await db.mis_tareas.add(tareaPendiente)
    setMisTareas(prev => [tareaPendiente, ...prev])
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
  }

  async function eliminarDeMisTareas(wo) {
    if (!wo) return

    await db.mis_tareas.where('wo').equals(wo).delete()
    setMisTareas(prev => prev.filter(tarea => tarea.wo !== wo))
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
      await syncFromSupabase()
      await cargarTareas()
      await cargarMisTareas()
      setSyncing(false)
    }

    if (session) {
      init()
    } else {
      setSyncing(false)
    }
  }, [session])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('atm-wo-vista', vista)
  }, [vista])

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
        <NavbarContent justify="end">
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
                onAction={key => setVista(String(key))}
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
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
          <NavbarItem>
            <Chip size="sm" variant="flat" color={syncing ? 'warning' : 'success'}>
              {syncing ? 'Sincronizando...' : `${tareas.length} tareas`}
            </Chip>
          </NavbarItem>
          <NavbarItem>
            <Button
              size="sm"
              variant="light"
              radius="lg"
              startContent={<LogOut size={14} />}
              onPress={cerrarSesion}
            >
              Salir
            </Button>
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
          />
        </div>

        <div className={vista === 'repuestos' ? 'block' : 'hidden'}>
          <PaginaRepuestos session={session} />
        </div>
      </main>
    </div>
  )
}

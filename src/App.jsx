import { useEffect, useState } from 'react'
import { syncFromSupabase } from './lib/sync'
import { db } from './lib/db'
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
} from '@heroui/react'
import { Boxes, ClipboardList, Menu, Package, Plus, Wrench } from 'lucide-react'

const VISTA_INICIAL = 'tareas'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList },
  { key: 'mis-tareas', label: 'Mis tareas', icon: Wrench },
  { key: 'repuestos', label: 'Repuestos', icon: Package },
]

function PaginaRepuestos() {
  const [repuestos, setRepuestos] = useState([])
  const [nombre, setNombre] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    async function cargarRepuestos() {
      const local = await db.repuestos.orderBy('localId').reverse().toArray()
      setRepuestos(local)
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

  async function crearRepuesto() {
    setMensaje(null)

    if (!validarFormulario()) return

    const nuevoRepuesto = {
      nombre: nombre.trim(),
      partNumber: partNumber.trim(),
      creadoEn: new Date().toISOString(),
    }

    const localId = await db.repuestos.add(nuevoRepuesto)
    setRepuestos(prev => [{ ...nuevoRepuesto, localId }, ...prev])
    setNombre('')
    setPartNumber('')
    setErrores({})
    setMensaje({
      color: 'success',
      texto: `Repuesto ${nuevoRepuesto.nombre} agregado correctamente.`,
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

          {repuestos.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-default-400">
              Aún no hay repuestos registrados.
            </div>
          ) : (
            <ScrollShadow className="max-h-[55vh] px-5 pb-5">
              <div className="space-y-3">
                {repuestos.map(repuesto => (
                  <Card
                    key={repuesto.localId}
                    shadow="sm"
                    className="border border-default-200/80 bg-white"
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-default-800">
                            {repuesto.nombre}
                          </p>
                          <p className="mt-1 text-xs text-default-500">
                            Registrado para inventario base
                          </p>
                        </div>
                        <Chip size="sm" variant="flat" color="primary" className="font-mono">
                          {repuesto.partNumber}
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </ScrollShadow>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

export default function App() {
  const [tareas, setTareas] = useState([])
  const [misTareas, setMisTareas] = useState([])
  const [syncing, setSyncing] = useState(true)
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
    async function init() {
      await cargarTareas()
      await cargarMisTareas()
      await syncFromSupabase()
      await cargarTareas()
      await cargarMisTareas()
      setSyncing(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('atm-wo-vista', vista)
  }, [vista])

  const vistaActiva = vistas.find(item => item.key === vista) || vistas[0]
  const VistaIcono = vistaActiva.icon

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
          <PaginaRepuestos />
        </div>
      </main>
    </div>
  )
}

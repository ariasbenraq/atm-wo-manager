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
} from '@heroui/react'
import { Boxes, ClipboardList, Menu, Package, Wrench } from 'lucide-react'

const VISTA_INICIAL = 'tareas'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList },
  { key: 'mis-tareas', label: 'Mis tareas', icon: Wrench },
  { key: 'repuestos', label: 'Repuestos', icon: Package },
]

function PaginaRepuestos() {
  return (
    <Card shadow="sm" className="border border-default-200/70">
      <CardBody className="p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-warning-100 p-3 text-warning-700">
            <Boxes size={22} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-default-800">Repuestos</h2>
            <p className="text-sm text-default-500">
              Esta vista queda disponible desde el menú hamburguesa para continuar el flujo sin
              reiniciar la aplicación ni perder la sesión actual.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
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

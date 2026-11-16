import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/usePermissions'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Chip,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import MuiAlert from '@mui/material/Alert'
import Fade from '@mui/material/Fade'
import { ClipboardList, Headset, List, LogOut, Menu, Package, Shield, ShoppingCart, Warehouse } from 'lucide-react'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList, path: '/tareas' },
  { key: 'wos', label: "Wo's", icon: Headset, path: '/wos' },
  { key: 'repuestos', label: 'Repuestos', icon: Package, path: '/repuestos' },
  { key: 'mis-listas', label: 'Mis listas', icon: List, path: '/mis-listas' },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingCart, path: '/pedidos' },
  { key: 'almacen', label: 'Almacén', icon: Warehouse, path: '/almacen' },
]

const vistasAdmin = [
  { key: 'admin/usuarios', label: 'Usuarios', icon: Shield, path: '/admin/usuarios' },
]

const CLAVES_INFERIOR = ['wos', 'pedidos', 'almacen', 'mis-listas']
const vistasInferior = CLAVES_INFERIOR.map(k => vistas.find(v => v.key === k))
const vistasMas = vistas.filter(v => !CLAVES_INFERIOR.includes(v.key))

function EnlaceLateral({ item, activa, onIr }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onIr(item.key)}
      aria-current={activa ? 'page' : undefined}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        activa ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={18} />
      {item.label}
    </button>
  )
}

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

function formatearTiempoRestanteCorto(ms) {
  const minutos = Math.max(0, Math.ceil(ms / 60000))
  if (minutos <= 1) return 'EN 1 MIN'
  if (minutos < 60) return `EN ${minutos} MIN`
  return 'EN 1 HORA'
}

export default function Layout() {
  const { session, authLoading, misTareas, syncing, cerrarSesion, sesionExpirada, profile } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  const [indiceAlertaProximaTarea, setIndiceAlertaProximaTarea] = useState(0)
  const [modalProximaTareaAbierto, setModalProximaTareaAbierto] = useState(false)
  const [modalReLoginAbierto, setModalReLoginAbierto] = useState(false)
  const [emailReLogin, setEmailReLogin] = useState('')
  const [passwordReLogin, setPasswordReLogin] = useState('')
  const [reLoginCargando, setReLoginCargando] = useState(false)
  const [reLoginError, setReLoginError] = useState(null)

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login', { replace: true })
    }
  }, [session, authLoading, navigate])

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
      { etiqueta: 'Dirección', valor: proximaTarea.tarea.direccion || 'Sin dirección' },
      { etiqueta: 'ID ATM', valor: proximaTarea.tarea.id_atm || 'Sin ID ATM' },
      { etiqueta: 'Modelo', valor: proximaTarea.tarea.modelo || 'Sin modelo' },
      { etiqueta: 'WO', valor: proximaTarea.tarea.wo || 'Sin WO' },
    ]
    : []
  const proximaTareaWo = proximaTarea?.tarea?.wo || null
  const totalDetallesAlerta = detallesAlerta.length

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndiceAlertaProximaTarea(0)
  }, [proximaTareaWo])

  useEffect(() => {
    if (!proximaTareaWo || totalDetallesAlerta <= 1) return

    const timer = window.setInterval(() => {
      setIndiceAlertaProximaTarea(prev => (prev + 1) % totalDetallesAlerta)
    }, 10000)

    return () => window.clearInterval(timer)
  }, [proximaTareaWo, totalDetallesAlerta])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-bg">
        <div className="flex items-center gap-3 text-sm text-default-500">
          <Spinner size="sm" />
          Verificando sesión...
        </div>
      </div>
    )
  }

  if (!session && !sesionExpirada) {
    return null
  }

  const detalleActivoAlerta = detallesAlerta[indiceAlertaProximaTarea % (detallesAlerta.length || 1)] || null
  const encabezadoAlerta = proximaTarea
    ? `PROXIMA TAREA ${formatearTiempoRestanteCorto(proximaTarea.marca - ahoraMs)}`
    : ''

  const path = location.pathname.replace(/^\//, '') || 'tareas'
  const vistaActiva = [...vistas, ...vistasAdmin].find(v => v.key === path) || vistas[0]
  const enMas = vistasMas.some(v => v.key === vistaActiva.key) || vistasAdmin.some(v => v.key === vistaActiva.key)

  function ir(key) {
    navigate(`/${key}`)
  }

  function salir() {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  async function handleReLogin() {
    setReLoginCargando(true)
    setReLoginError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: emailReLogin.trim(),
      password: passwordReLogin,
    })

    setReLoginCargando(false)

    if (error) {
      setReLoginError(error.message)
      return
    }

    setEmailReLogin('')
    setPasswordReLogin('')
    setModalReLoginAbierto(false)
  }

  return (
    <div className="min-h-screen app-bg text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-nav text-white lg:flex">
        <div className="px-5 pb-4 pt-5">
          <span className="text-lg font-bold tracking-[0.2em]">ATM·WO</span>
          <p className="text-xs text-white/50">Órdenes de trabajo y almacén</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Navegación principal">
          {vistas.map(item => <EnlaceLateral key={item.key} item={item} activa={item.key === vistaActiva.key} onIr={ir} />)}
          {esAdmin && (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">Administración</p>
              {vistasAdmin.map(item => <EnlaceLateral key={item.key} item={item} activa={item.key === vistaActiva.key} onIr={ir} />)}
            </>
          )}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 min-w-0 px-2">
            <p className="truncate text-sm font-medium">{profile?.full_name || profile?.username || 'Técnico'}</p>
            <p className="truncate font-mono text-xs text-white/50">{profile?.legajo || 'Sin legajo'}</p>
          </div>
          <button
            type="button"
            onClick={salir}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
      <Navbar isBordered maxWidth="full" height="3.5rem" className="bg-background/85 backdrop-blur-md">
        <NavbarBrand className="min-w-0 grow-0 basis-auto">
          <span className="text-sm font-bold tracking-[0.2em] text-primary lg:hidden">ATM·WO</span>
          <h1 className="hidden text-base font-semibold text-foreground lg:block">{vistaActiva.label}</h1>
        </NavbarBrand>
        <NavbarContent
          justify="center"
          className="min-w-0 flex-1 px-1"
        >
          <div className="w-full min-w-0 max-w-full sm:mx-auto sm:max-w-lg">
            {proximaTarea && detalleActivoAlerta ? (
              <MuiAlert
                severity="info"
                variant="standard"
                icon={false}
                onClick={() => setModalProximaTareaAbierto(true)}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  px: 0,
                  py: 0,
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  color: 'rgb(24, 24, 27)',
                  boxShadow: 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                  minWidth: 0,
                  '&::before': {
                    display: 'none',
                  },
                  '& .MuiAlert-message': {
                    width: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                    py: 0,
                  },
                }}
              >
                <div className="min-w-0 overflow-hidden text-center leading-tight">
                  <p className="overflow-hidden whitespace-nowrap text-[10px] font-semibold text-default-600 sm:text-[11px]">
                    {encabezadoAlerta}
                  </p>
                  <Fade
                    in={Boolean(detalleActivoAlerta)}
                    timeout={500}
                    key={`${proximaTareaWo || 'sin-tarea'}-${indiceAlertaProximaTarea}`}
                  >
                    <p className="overflow-hidden whitespace-nowrap text-xs font-semibold text-default-900 sm:text-sm">
                      {detalleActivoAlerta.etiqueta}: {detalleActivoAlerta.valor}
                    </p>
                  </Fade>
                </div>
              </MuiAlert>
            ) : <div />}
          </div>
        </NavbarContent>
        <NavbarContent justify="end" className="shrink-0 grow-0 basis-auto">
          {syncing && (
            <NavbarItem>
              <Chip size="sm" variant="flat" color="warning">Sincronizando…</Chip>
            </NavbarItem>
          )}
        </NavbarContent>
      </Navbar>

      {sesionExpirada && !session && (
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4">
          <HeroAlert
            color="warning"
            title="Sesión expirada"
            description="Tus datos locales aún están disponibles. Inicia sesión de nuevo para seguir sincronizando."
            endContent={
              <Button
                size="sm"
                color="warning"
                variant="flat"
                radius="lg"
                onPress={() => setModalReLoginAbierto(true)}
              >
                Iniciar sesión
              </Button>
            }
          />
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-28 md:space-y-5 md:p-6 lg:max-w-5xl lg:pb-10">
        <Outlet />
      </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-default-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegación principal"
      >
        {vistasInferior.map(item => {
          const Icon = item.icon
          const activa = item.key === vistaActiva.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => ir(item.key)}
              aria-current={activa ? 'page' : undefined}
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${activa ? 'text-primary' : 'text-default-500'}`}
            >
              <Icon size={22} strokeWidth={activa ? 2.4 : 1.8} />
              {item.label}
            </button>
          )
        })}
        <Dropdown placement="top-end">
          <DropdownTrigger>
            <button
              type="button"
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${enMas ? 'text-primary' : 'text-default-500'}`}
            >
              <Menu size={22} strokeWidth={enMas ? 2.4 : 1.8} />
              Más
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Más opciones"
            onAction={key => (String(key) === 'salir' ? salir() : ir(String(key)))}
          >
            {[...vistasMas, ...(esAdmin ? vistasAdmin : [])].map(item => {
              const Icon = item.icon
              return (
                <DropdownItem key={item.key} startContent={<Icon size={16} />}>
                  {item.label}
                </DropdownItem>
              )
            })}
            <DropdownItem key="salir" color="danger" startContent={<LogOut size={16} />}>
              Salir
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </nav>

      <Modal
        isOpen={modalProximaTareaAbierto}
        onOpenChange={abierto => setModalProximaTareaAbierto(abierto)}
      >
        <ModalContent>
          <>
            <ModalHeader>Próxima tarea</ModalHeader>
            <ModalBody>
              {proximaTarea?.tarea ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">Agencia</p>
                    <p className="text-sm font-semibold text-default-800">{proximaTarea.tarea.nombre || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">WO</p>
                    <p className="text-sm font-mono font-semibold text-default-800">{proximaTarea.tarea.wo || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">ID ATM</p>
                    <p className="text-sm font-mono font-semibold text-default-800">{proximaTarea.tarea.id_atm || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">Modelo</p>
                    <p className="text-sm font-semibold text-default-800">{proximaTarea.tarea.modelo || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">Fecha</p>
                    <p className="text-sm font-semibold text-default-800">{proximaTarea.tarea.fecha || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">Hora</p>
                    <p className="text-sm font-mono font-semibold text-default-800">{proximaTarea.tarea.hora || '—'}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-default-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">Dirección</p>
                    <p className="text-sm font-semibold text-default-800">{proximaTarea.tarea.direccion || '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-default-500">No hay una tarea próxima disponible.</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setModalProximaTareaAbierto(false)}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={modalReLoginAbierto}
        onOpenChange={abierto => {
          setModalReLoginAbierto(abierto)
          if (!abierto) {
            setEmailReLogin('')
            setPasswordReLogin('')
            setReLoginError(null)
          }
        }}
      >
        <ModalContent>
          <>
            <ModalHeader>Iniciar sesión</ModalHeader>
            <ModalBody className="space-y-3">
              <Input
                label="Correo"
                type="email"
                placeholder="tecnico@ncr.com"
                value={emailReLogin}
                onValueChange={setEmailReLogin}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={passwordReLogin}
                onValueChange={setPasswordReLogin}
                variant="bordered"
                radius="lg"
              />
              {reLoginError && (
                <p className="text-sm text-danger">{reLoginError}</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={() => {
                  setModalReLoginAbierto(false)
                  setEmailReLogin('')
                  setPasswordReLogin('')
                  setReLoginError(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={handleReLogin}
                isLoading={reLoginCargando}
              >
                Entrar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

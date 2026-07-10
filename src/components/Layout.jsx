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
  Card,
  CardBody,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Divider,
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
import { ClipboardList, List, LogOut, Menu, Package, Shield, Wrench } from 'lucide-react'

const vistas = [
  { key: 'tareas', label: 'Tareas', icon: ClipboardList, path: '/tareas' },
  { key: 'mis-tareas', label: 'Mis tareas', icon: Wrench, path: '/mis-tareas' },
  { key: 'repuestos', label: 'Repuestos', icon: Package, path: '/repuestos' },
  { key: 'mis-listas', label: 'Mis listas', icon: List, path: '/mis-listas' },
]

const vistasAdmin = [
  { key: 'admin/usuarios', label: 'Usuarios', icon: Shield, path: '/admin/usuarios' },
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

function formatearTiempoRestanteCorto(ms) {
  const minutos = Math.max(0, Math.ceil(ms / 60000))
  if (minutos <= 1) return 'EN 1 MIN'
  if (minutos < 60) return `EN ${minutos} MIN`
  return 'EN 1 HORA'
}

export default function Layout() {
  const { session, authLoading, misTareas, syncing, tareas, cerrarSesion, sesionExpirada } = useApp()
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-default-100 via-default-50 to-white">
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
  const vistaActiva = vistas.find(v => v.key === path) || vistas[0]
  const VistaIcono = vistaActiva.icon

  function irAProximaTarea() {
    if (!proximaTarea?.tarea?.wo) return
    setModalProximaTareaAbierto(false)
    navigate(`/mis-tareas?wo=${proximaTarea.tarea.wo}`)
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
    <div className="min-h-screen bg-gradient-to-b from-default-100 via-default-50 to-white">
      <Navbar isBordered maxWidth="md" className="relative flex-wrap items-center bg-white/85 backdrop-blur-md">
        <NavbarBrand className="hidden sm:flex min-w-[112px]" />
        <NavbarContent
          justify="center"
          className="order-1 min-w-0 flex-1 px-3 py-2 sm:order-2 sm:basis-auto sm:px-2 sm:py-0"
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
        <NavbarContent
          justify="end"
          className="order-2 ml-auto shrink-0 basis-auto px-3 py-2 sm:order-3 sm:px-0 sm:py-0"
        >
          <NavbarItem className="hidden sm:flex">
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
                selectedKeys={[vistaActiva.key]}
                selectionMode="single"
                onAction={key => {
                  if (String(key) === 'salir') {
                    cerrarSesion()
                    navigate('/login', { replace: true })
                    return
                  }

                  navigate(`/${key}`)
                }}
              >
                {vistas.map(item => {
                  const Icon = item.icon
                  return (
                    <DropdownItem
                      key={item.key}
                      startContent={<Icon size={16} />}
                      description={item.key === vistaActiva.key ? 'Vista actual' : undefined}
                    >
                      {item.label}
                    </DropdownItem>
                  )
                })}
                {esAdmin && vistasAdmin.map(item => {
                  const Icon = item.icon
                  return (
                    <DropdownItem
                      key={item.key}
                      startContent={<Icon size={16} />}
                      description={item.key === vistaActiva.key ? 'Vista actual' : 'Solo administradores'}
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

        <Outlet />
      </main>

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
              <Button color="primary" onPress={irAProximaTarea} isDisabled={!proximaTarea?.tarea?.wo}>
                Ir a la tarea
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

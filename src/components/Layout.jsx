import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/usePermissions'
import { esModoDemo } from '../lib/demo/modoDemo'
import { useTelemetria } from '../hooks/useTelemetria'
import CuentaBloqueada from './CuentaBloqueada'
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
import { useTema, ETIQUETA_TEMA } from '../hooks/useTema'
import { Activity, Headset, Home, Moon, Sun, SunMoon, List, LogOut, Menu, Package, Route, Shield, ShoppingCart, Warehouse } from 'lucide-react'

const vistas = [
  { key: 'inicio', label: 'Inicio', icon: Home, path: '/inicio' },
  { key: 'wos', label: "Wo's", icon: Headset, path: '/wos' },
  { key: 'repuestos', label: 'Repuestos', icon: Package, path: '/repuestos' },
  { key: 'mis-listas', label: 'Mis listas', icon: List, path: '/mis-listas' },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingCart, path: '/pedidos' },
  { key: 'almacen', label: 'Almacén', icon: Warehouse, path: '/almacen' },
  { key: 'movilidades', label: 'Movilidades', icon: Route, path: '/movilidades' },
]

const vistasAdmin = [
  { key: 'admin/usuarios', label: 'Usuarios', icon: Shield, path: '/admin/usuarios' },
  { key: 'admin/monitoreo', label: 'Monitoreo', icon: Activity, path: '/admin/monitoreo' },
]

const CLAVES_INFERIOR = ['inicio', 'wos', 'pedidos', 'mis-listas', 'almacen']
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

export default function Layout() {
  const { session, authLoading, syncing, cerrarSesion, sesionExpirada, profile } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const enDemo = esModoDemo()
  // La demo no registra telemetría (no debe escribir nada en la base de datos)
  useTelemetria(Boolean(session) && !enDemo && (!profile?.estado || profile.estado === 'activo'))
  const { tema, alternar: alternarTema } = useTema()
  const IconoTema = tema === 'oscuro' ? Moon : tema === 'claro' ? Sun : SunMoon
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

  if (session && profile && profile.estado && profile.estado !== 'activo') {
    return (
      <CuentaBloqueada
        estado={profile.estado}
        nombre={profile.nombre}
        onSalir={() => {
          cerrarSesion()
          navigate('/login', { replace: true })
        }}
      />
    )
  }

  const path = location.pathname.replace(/^\//, '') || 'inicio'
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
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-widest text-white/65">Administración</p>
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
            onClick={alternarTema}
            aria-label={`Tema: ${ETIQUETA_TEMA[tema]}. Cambiar`}
            className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <IconoTema size={16} /> Tema: {ETIQUETA_TEMA[tema]}
          </button>
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
        <NavbarContent justify="center" className="min-w-0 flex-1 px-1" aria-hidden="true" />
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
        {enDemo && (
          <div role="status" className="rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:bg-warning-100/10 dark:text-warning-600">
            <strong>Modo demostración:</strong> los datos son ficticios y temporales. Nada se guarda en la base de datos
            y todo se borra al salir. Los formularios de Google (consumo de repuestos y movilidad) sí se abren con datos prellenados.
          </div>
        )}
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
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs font-medium ${activa ? 'text-primary' : 'text-default-500'}`}
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
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs font-medium ${enMas ? 'text-primary' : 'text-default-500'}`}
            >
              <Menu size={22} strokeWidth={enMas ? 2.4 : 1.8} />
              Más
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Más opciones"
            onAction={key => {
              if (String(key) === 'salir') salir()
              else if (String(key) === 'tema') alternarTema()
              else ir(String(key))
            }}
          >
            {[...vistasMas, ...(esAdmin ? vistasAdmin : [])].map(item => {
              const Icon = item.icon
              return (
                <DropdownItem key={item.key} startContent={<Icon size={16} />}>
                  {item.label}
                </DropdownItem>
              )
            })}
            <DropdownItem key="tema" startContent={<IconoTema size={16} />}>
              Tema: {ETIQUETA_TEMA[tema]}
            </DropdownItem>
            <DropdownItem key="salir" color="danger" startContent={<LogOut size={16} />}>
              Salir
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </nav>

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

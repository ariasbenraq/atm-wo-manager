import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/usePermissions'
import {
  Button, Chip, Input,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import { Shield, ShieldOff, Search, Pencil } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function AdminUsuariosPage() {
  const { session, profile } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [perfilEditando, setPerfilEditando] = useState(null)
  const [formNombre, setFormNombre] = useState('')
  const [formLegajo, setFormLegajo] = useState('')
  const [errorPerfil, setErrorPerfil] = useState(null)

  async function cargarUsuarios() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch {
      setMensaje({ color: 'danger', texto: 'No se pudieron cargar los usuarios.' })
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    // Mientras el perfil no cargó no se sabe si es admin: no redirigir todavía
    if (!profile) return
    if (!esAdmin) {
      navigate('/repuestos', { replace: true })
      return
    }
    cargarUsuarios()
  }, [esAdmin, profile, navigate])

  function abrirCambioRol(usuario) {
    setEditandoUsuario(usuario)
    setNuevoRol(usuario.role === 'admin' ? 'user' : 'admin')
    setGuardando(false)
  }

  function cerrarCambioRol() {
    setEditandoUsuario(null)
    setNuevoRol(null)
  }

  async function confirmarCambioRol() {
    if (!editandoUsuario || !nuevoRol) return
    setGuardando(true)

    const { error } = await supabase
      .from('profiles')
      .update({ role: nuevoRol })
      .eq('id', editandoUsuario.id)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      setGuardando(false)
      return
    }

    setUsuarios(prev => prev.map(u =>
      u.id === editandoUsuario.id ? { ...u, role: nuevoRol } : u
    ))

    setMensaje({
      color: 'success',
      texto: `Rol de ${editandoUsuario.full_name || editandoUsuario.email} cambiado a "${nuevoRol}".`,
    })
    cerrarCambioRol()
  }

  function abrirEditarPerfil(usuario) {
    setPerfilEditando(usuario)
    setFormNombre(usuario.full_name || '')
    setFormLegajo(usuario.legajo || '')
    setErrorPerfil(null)
    setGuardando(false)
  }

  async function guardarPerfil() {
    if (!perfilEditando) return
    const nombre = formNombre.trim()
    const legajo = formLegajo.replace(/\s+/g, '').toUpperCase()
    if (!nombre) {
      setErrorPerfil('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setErrorPerfil(null)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nombre, legajo })
      .eq('id', perfilEditando.id)

    if (error) {
      setErrorPerfil(
        error.code === '23505'
          ? 'Ese legajo ya está asignado a otro usuario.'
          : error.message
      )
      setGuardando(false)
      return
    }

    setUsuarios(prev => prev.map(u =>
      u.id === perfilEditando.id ? { ...u, full_name: nombre, legajo } : u
    ))
    setMensaje({ color: 'success', texto: `Perfil de ${nombre} actualizado.` })
    setPerfilEditando(null)
    setGuardando(false)
  }

  const filtroNormalizado = filtro.toLowerCase().trim()
  const usuariosFiltrados = filtroNormalizado
    ? usuarios.filter(u =>
        (u.full_name || '').toLowerCase().includes(filtroNormalizado) ||
        (u.legajo || '').toLowerCase().includes(filtroNormalizado) ||
        (u.email || '').toLowerCase().includes(filtroNormalizado)
      )
    : usuarios

  if (!esAdmin) return null

  return (
    <div className="space-y-5">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Administración de usuarios"
          description={mensaje.texto}
        />
      )}

      <PageHeader icon={Shield} title="Usuarios" subtitle="Administra los roles, nombres y legajos del sistema" />

      <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-default-900">Todos los usuarios</p>
            <Chip size="sm" variant="flat" color="primary" className="shrink-0 text-xs font-medium">
              {usuarios.length} usuario{usuarios.length === 1 ? '' : 's'}
            </Chip>
          </div>
          <div className="mt-4">
            <Input
              label=""
              placeholder="Buscar por nombre, legajo o email..."
              value={filtro}
              onValueChange={setFiltro}
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

        {cargando ? (
          <div className="p-4 text-sm text-default-400">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-4 text-sm text-default-400">
            {filtroNormalizado ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
          </div>
        ) : (
          <div className="px-5 pb-5">
            <div className="overflow-hidden rounded-xl border border-default-200 mt-5">
              <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-default-100 bg-default-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-default-400">
                <span>Nombre / Email</span>
                <span className="text-right pr-14">Rol</span>
              </div>
              <div className="divide-y divide-default-100">
                {usuariosFiltrados.map(usuario => (
                  <div
                    key={usuario.id}
                    className="grid grid-cols-[1fr_auto] gap-2 p-3 items-center transition-colors hover:bg-default-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-default-900">
                        {usuario.full_name || '—'}
                      </p>
                      <p className="truncate text-sm text-default-500">
                        {usuario.email || '—'}
                      </p>
                      {usuario.legajo ? (
                        <p className="font-mono text-xs text-default-600">{usuario.legajo}</p>
                      ) : (
                        <p className="text-xs text-warning-700">Sin legajo</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={usuario.role === 'admin' ? 'warning' : 'default'}
                        className="text-xs font-medium"
                      >
                        {usuario.role === 'admin' ? 'Admin' : 'Usuario'}
                      </Chip>
                      <Button
                        size="sm"
                        variant="light"
                        radius="lg"
                        className="h-8 min-w-8 p-0 text-default-400 hover:text-default-700"
                        aria-label="Editar nombre y legajo"
                        onPress={() => abrirEditarPerfil(usuario)}
                      >
                        <Pencil size={15} />
                      </Button>
                      {session?.user?.id !== usuario.id && (
                        <Button
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="h-8 min-w-8 p-0 text-default-400 hover:text-default-700"
                          aria-label="Cambiar rol"
                          onPress={() => abrirCambioRol(usuario)}
                        >
                          {usuario.role === 'admin' ? <ShieldOff size={15} /> : <Shield size={15} />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(perfilEditando)} onOpenChange={abierto => !abierto && setPerfilEditando(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Editar técnico</ModalHeader>
            <ModalBody className="space-y-3">
              <Input
                label="Nombre"
                value={formNombre}
                onValueChange={setFormNombre}
                variant="bordered"
                radius="lg"
              />
              <Input
                label="Legajo"
                placeholder="PE101L84"
                value={formLegajo}
                onValueChange={v => setFormLegajo(v.toUpperCase())}
                variant="bordered"
                radius="lg"
              />
              <p className="text-xs text-default-400">
                El legajo determina qué filas importa este usuario del Excel y se usa en el formulario de consumo.
              </p>
              {errorPerfil && <p className="text-sm text-danger">{errorPerfil}</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={() => setPerfilEditando(null)}>
                Cancelar
              </Button>
              <Button color="primary" radius="lg" onPress={guardarPerfil} isLoading={guardando}>
                Guardar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(editandoUsuario)} onOpenChange={abierto => !abierto && cerrarCambioRol()}>
        <ModalContent>
          <>
            <ModalHeader className="text-default-900">Cambiar rol de usuario</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Cambiar el rol de <strong>{editandoUsuario?.full_name || editandoUsuario?.email}</strong> de{' '}
                <strong>{editandoUsuario?.role}</strong> a <strong>{nuevoRol}</strong>?
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={cerrarCambioRol}>
                Cancelar
              </Button>
              <Button
                color="primary"
                radius="lg"
                onPress={confirmarCambioRol}
                isLoading={guardando}
              >
                Confirmar cambio
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

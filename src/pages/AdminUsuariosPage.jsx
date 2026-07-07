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
import { Shield, ShieldOff, Search, ArrowLeft } from 'lucide-react'

export default function AdminUsuariosPage() {
  const { session } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState(null)
  const [guardando, setGuardando] = useState(false)

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
    if (!esAdmin) {
      navigate('/repuestos', { replace: true })
      return
    }
    cargarUsuarios()
  }, [esAdmin, navigate])

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

  const filtroNormalizado = filtro.toLowerCase().trim()
  const usuariosFiltrados = filtroNormalizado
    ? usuarios.filter(u =>
        (u.full_name || '').toLowerCase().includes(filtroNormalizado) ||
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

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
            <Shield size={20} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-default-900 leading-tight">Usuarios</h2>
            <p className="text-sm text-default-500">
              Administra los roles y accesos del sistema
            </p>
          </div>
        </div>
        <Button
          variant="light"
          radius="lg"
          startContent={<ArrowLeft size={16} />}
          onPress={() => navigate('/repuestos')}
          className="shrink-0 text-[14px] font-medium text-default-600 hover:bg-default-100 h-9"
        >
          Volver
        </Button>
      </div>

      <div className="rounded-xl border border-default-200 bg-white overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-default-900">Todos los usuarios</p>
            <Chip size="sm" variant="flat" color="primary" className="shrink-0 text-[12px] font-medium">
              {usuarios.length} usuario{usuarios.length === 1 ? '' : 's'}
            </Chip>
          </div>
          <div className="mt-4">
            <Input
              label=""
              placeholder="Buscar por nombre o email..."
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
          <div className="px-5 py-4 text-sm text-default-400">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="px-5 py-4 text-sm text-default-400">
            {filtroNormalizado ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
          </div>
        ) : (
          <div className="px-5 pb-5">
            <div className="overflow-hidden rounded-xl border border-default-200 mt-5">
              <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-default-100 bg-default-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-default-400">
                <span>Nombre / Email</span>
                <span className="text-right pr-14">Rol</span>
              </div>
              <div className="divide-y divide-default-100">
                {usuariosFiltrados.map(usuario => (
                  <div
                    key={usuario.id}
                    className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 items-center transition-colors hover:bg-default-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-default-900">
                        {usuario.full_name || '—'}
                      </p>
                      <p className="truncate text-[13px] text-default-500">
                        {usuario.email || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={usuario.role === 'admin' ? 'warning' : 'default'}
                        className="text-[12px] font-medium"
                      >
                        {usuario.role === 'admin' ? 'Admin' : 'Usuario'}
                      </Chip>
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

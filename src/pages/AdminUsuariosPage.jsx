import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/usePermissions'
import {
  cambiarEstadoUsuario,
  reiniciarClaveUsuario,
  cambiarEmailUsuario,
  eliminarUsuario,
} from '../lib/adminUsuarios'
import { CONTRATAS, normalizarLegajo } from '../lib/registro'
import {
  Button, Chip, Input, Select, SelectItem,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import {
  Shield, ShieldOff, Search, Pencil, MoreVertical, KeyRound, Ban, UserCheck, Copy,
  Trash2, TriangleAlert,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', color: 'warning' },
  activo: { etiqueta: 'Activo', color: 'success' },
  suspendido: { etiqueta: 'Suspendido', color: 'danger' },
}

const FILTROS = [
  { key: 'todos', etiqueta: 'Todos' },
  { key: 'pendiente', etiqueta: 'Pendientes' },
  { key: 'activo', etiqueta: 'Activos' },
  { key: 'suspendido', etiqueta: 'Suspendidos' },
]

export default function AdminUsuariosPage() {
  const { session, profile } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Cambio de rol
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState(null)

  // Edición de perfil
  const [perfilEditando, setPerfilEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', contrata: '', legajo: '' })
  const [errorPerfil, setErrorPerfil] = useState(null)

  // Cambio de estado (aprobar / suspender / reactivar)
  const [estadoPendiente, setEstadoPendiente] = useState(null) // { usuario, estado }

  // Eliminación de cuenta (también «rechazar» una solicitud pendiente)
  const [eliminando, setEliminando] = useState(null)
  const [fraseConfirmacion, setFraseConfirmacion] = useState('')

  // Reinicio de clave
  const [reiniciando, setReiniciando] = useState(null)
  const [linkGenerado, setLinkGenerado] = useState(null)

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

  const nombreDe = u => u.full_name || u.email

  function actualizarLocal(id, cambios) {
    setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, ...cambios } : u)))
  }

  // ---- Rol ----
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

    actualizarLocal(editandoUsuario.id, { role: nuevoRol })
    setMensaje({
      color: 'success',
      texto: `Rol de ${nombreDe(editandoUsuario)} cambiado a "${nuevoRol}".`,
    })
    cerrarCambioRol()
  }

  // ---- Edición de perfil ----
  function abrirEditarPerfil(usuario) {
    setPerfilEditando(usuario)
    setForm({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      contrata: usuario.contrata || '',
      legajo: usuario.legajo || '',
    })
    setErrorPerfil(null)
    setGuardando(false)
  }

  async function guardarPerfil() {
    if (!perfilEditando) return
    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    const email = form.email.trim().toLowerCase()
    const legajo = normalizarLegajo(form.legajo)
    if (!nombre || !apellido) {
      setErrorPerfil('Nombre y apellido son obligatorios.')
      return
    }
    setGuardando(true)
    setErrorPerfil(null)

    const full_name = `${nombre} ${apellido}`
    const { error } = await supabase
      .from('profiles')
      .update({ nombre, apellido, full_name, legajo, contrata: form.contrata || null })
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

    const cambios = { nombre, apellido, full_name, legajo, contrata: form.contrata || null }

    // El correo vive también en Auth: solo lo cambia la Edge Function
    if (email && email !== (perfilEditando.email || '').toLowerCase()) {
      try {
        await cambiarEmailUsuario(perfilEditando.id, email)
        cambios.email = email
      } catch (e) {
        actualizarLocal(perfilEditando.id, cambios)
        setErrorPerfil(`Se guardó el perfil, pero el correo no cambió: ${e.message}`)
        setGuardando(false)
        return
      }
    }

    actualizarLocal(perfilEditando.id, cambios)
    setMensaje({ color: 'success', texto: `Perfil de ${full_name} actualizado.` })
    setPerfilEditando(null)
    setGuardando(false)
  }

  // ---- Estado ----
  async function confirmarEstado() {
    if (!estadoPendiente) return
    const { usuario, estado } = estadoPendiente
    setGuardando(true)
    try {
      await cambiarEstadoUsuario(usuario.id, estado)
      actualizarLocal(usuario.id, {
        estado,
        suspendido_en: estado === 'suspendido' ? new Date().toISOString() : null,
      })
      const accion = estado === 'suspendido'
        ? 'suspendido'
        : usuario.estado === 'pendiente' ? 'aprobado' : 'reactivado'
      setMensaje({ color: 'success', texto: `${nombreDe(usuario)} fue ${accion}.` })
      setEstadoPendiente(null)
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message })
      setEstadoPendiente(null)
    } finally {
      setGuardando(false)
    }
  }

  // ---- Eliminación ----
  const FRASE_ELIMINAR = 'Eliminar cuenta'

  function abrirEliminar(usuario) {
    setEliminando(usuario)
    setFraseConfirmacion('')
  }

  async function confirmarEliminar() {
    if (!eliminando || fraseConfirmacion !== FRASE_ELIMINAR) return
    setGuardando(true)
    try {
      await eliminarUsuario(eliminando.id, fraseConfirmacion)
      setUsuarios(prev => prev.filter(u => u.id !== eliminando.id))
      setMensaje({
        color: 'success',
        texto: eliminando.estado === 'pendiente'
          ? `Solicitud de ${nombreDe(eliminando)} rechazada y cuenta eliminada.`
          : `Cuenta de ${nombreDe(eliminando)} eliminada.`,
      })
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message })
    } finally {
      setEliminando(null)
      setGuardando(false)
    }
  }

  // ---- Reinicio de clave ----
  async function reiniciarClave(enviarCorreo) {
    if (!reiniciando) return
    setGuardando(true)
    try {
      const res = await reiniciarClaveUsuario(reiniciando.id, enviarCorreo)
      actualizarLocal(reiniciando.id, { clave_reiniciada_en: new Date().toISOString() })
      if (res.enviado) {
        setMensaje({
          color: 'success',
          texto: `Se envió el correo de recuperación a ${reiniciando.email}.`,
        })
        setReiniciando(null)
      } else {
        setLinkGenerado({ usuario: reiniciando, link: res.link })
        setReiniciando(null)
      }
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message })
      setReiniciando(null)
    } finally {
      setGuardando(false)
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkGenerado.link)
      setMensaje({ color: 'success', texto: 'Enlace copiado al portapapeles.' })
    } catch {
      setMensaje({ color: 'warning', texto: 'No se pudo copiar automáticamente: selecciona el enlace y cópialo.' })
    }
  }

  const filtroNormalizado = filtro.toLowerCase().trim()
  const usuariosFiltrados = usuarios.filter(u => {
    if (filtroEstado !== 'todos' && (u.estado || 'activo') !== filtroEstado) return false
    if (!filtroNormalizado) return true
    return (
      (u.full_name || '').toLowerCase().includes(filtroNormalizado) ||
      (u.legajo || '').toLowerCase().includes(filtroNormalizado) ||
      (u.email || '').toLowerCase().includes(filtroNormalizado)
    )
  })
  const pendientes = usuarios.filter(u => u.estado === 'pendiente').length

  if (!esAdmin) return null

  return (
    <div className="space-y-4">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Administración de usuarios"
          description={mensaje.texto}
        />
      )}

      <PageHeader
        icon={Shield}
        title="Usuarios"
        subtitle="Aprueba registros, edita datos, reinicia claves y suspende accesos"
      />

      <div className="overflow-hidden rounded-xl border border-default-200 bg-content1">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-foreground">Todos los usuarios</p>
            <div className="flex items-center gap-2">
              {pendientes > 0 && (
                <Chip size="sm" variant="flat" color="warning" className="text-xs font-medium">
                  {pendientes} pendiente{pendientes === 1 ? '' : 's'}
                </Chip>
              )}
              <Chip size="sm" variant="flat" color="primary" className="shrink-0 text-xs font-medium">
                {usuarios.length} usuario{usuarios.length === 1 ? '' : 's'}
              </Chip>
            </div>
          </div>

          <Input
            aria-label="Buscar usuarios"
            placeholder="Buscar por nombre, legajo o email..."
            value={filtro}
            onValueChange={setFiltro}
            variant="bordered"
            radius="lg"
            size="sm"
            startContent={<Search size={15} className="text-default-400" />}
            classNames={{ inputWrapper: 'bg-default-50 border-default-200' }}
          />

          <div className="flex flex-wrap gap-2">
            {FILTROS.map(f => (
              <Button
                key={f.key}
                size="sm"
                radius="full"
                variant={filtroEstado === f.key ? 'solid' : 'flat'}
                color={filtroEstado === f.key ? 'primary' : 'default'}
                className="text-xs"
                onPress={() => setFiltroEstado(f.key)}
              >
                {f.etiqueta}
              </Button>
            ))}
          </div>
        </div>
        <div className="border-b border-default-100" />

        {cargando ? (
          <div className="p-4 text-sm text-default-500">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-4 text-sm text-default-500">
            {filtroNormalizado || filtroEstado !== 'todos'
              ? 'No se encontraron usuarios con ese criterio.'
              : 'No hay usuarios registrados.'}
          </div>
        ) : (
          <div className="divide-y divide-default-100">
            {usuariosFiltrados.map(usuario => {
              const estado = usuario.estado || 'activo'
              const propio = session?.user?.id === usuario.id
              return (
                <div
                  key={usuario.id}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-default-50"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {usuario.full_name || '—'}
                    </p>
                    <p className="truncate text-sm text-default-500">{usuario.email || '—'}</p>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs">
                      {usuario.legajo ? (
                        <span className="font-mono text-default-600">{usuario.legajo}</span>
                      ) : (
                        <span className="text-warning-700">Sin legajo</span>
                      )}
                      <span className="text-default-500">{usuario.contrata || 'Sin contrata'}</span>
                      {usuario.clave_reiniciada_en && (
                        <span className="text-warning-700">Clave reiniciada</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <Chip size="sm" variant="flat" color={ESTADOS[estado].color} className="text-xs font-medium">
                        {ESTADOS[estado].etiqueta}
                      </Chip>
                      {usuario.role === 'admin' && (
                        <Chip size="sm" variant="flat" color="warning" className="text-xs font-medium">
                          Admin
                        </Chip>
                      )}
                    </div>

                    {estado === 'pendiente' && !propio && (
                      <>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          radius="lg"
                          className="min-h-9"
                          startContent={<Trash2 size={15} />}
                          onPress={() => abrirEliminar(usuario)}
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          radius="lg"
                          className="min-h-9"
                          startContent={<UserCheck size={15} />}
                          onPress={() => setEstadoPendiente({ usuario, estado: 'activo' })}
                        >
                          Aprobar
                        </Button>
                      </>
                    )}

                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          radius="lg"
                          className="h-9 min-w-9 text-default-500"
                          aria-label={`Acciones de ${nombreDe(usuario)}`}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Acciones de usuario"
                        disabledKeys={propio ? ['clave', 'suspender', 'reactivar', 'rol', 'eliminar'] : []}
                      >
                        <DropdownItem
                          key="editar"
                          startContent={<Pencil size={14} />}
                          onPress={() => abrirEditarPerfil(usuario)}
                        >
                          Editar datos
                        </DropdownItem>
                        <DropdownItem
                          key="clave"
                          startContent={<KeyRound size={14} />}
                          onPress={() => setReiniciando(usuario)}
                        >
                          Reiniciar clave
                        </DropdownItem>
                        <DropdownItem
                          key="rol"
                          startContent={usuario.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          onPress={() => abrirCambioRol(usuario)}
                        >
                          {usuario.role === 'admin' ? 'Quitar rol admin' : 'Hacer admin'}
                        </DropdownItem>
                        {estado === 'suspendido' ? (
                          <DropdownItem
                            key="reactivar"
                            startContent={<UserCheck size={14} />}
                            onPress={() => setEstadoPendiente({ usuario, estado: 'activo' })}
                          >
                            Reactivar
                          </DropdownItem>
                        ) : (
                          <DropdownItem
                            key="suspender"
                            className="text-danger"
                            color="danger"
                            startContent={<Ban size={14} />}
                            onPress={() => setEstadoPendiente({ usuario, estado: 'suspendido' })}
                          >
                            Suspender
                          </DropdownItem>
                        )}
                        <DropdownItem
                          key="eliminar"
                          className="text-danger"
                          color="danger"
                          startContent={<Trash2 size={14} />}
                          onPress={() => abrirEliminar(usuario)}
                        >
                          Eliminar cuenta
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Editar datos */}
      <Modal isOpen={Boolean(perfilEditando)} onOpenChange={abierto => !abierto && setPerfilEditando(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-foreground">Editar usuario</ModalHeader>
            <ModalBody className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Nombre"
                  value={form.nombre}
                  onValueChange={v => setForm(p => ({ ...p, nombre: v }))}
                  variant="bordered"
                  radius="lg"
                />
                <Input
                  label="Apellido"
                  value={form.apellido}
                  onValueChange={v => setForm(p => ({ ...p, apellido: v }))}
                  variant="bordered"
                  radius="lg"
                />
              </div>
              <Input
                label="Correo electrónico"
                type="email"
                value={form.email}
                onValueChange={v => setForm(p => ({ ...p, email: v }))}
                variant="bordered"
                radius="lg"
              />
              <Select
                label="Contrata"
                selectedKeys={form.contrata ? [form.contrata] : []}
                onSelectionChange={keys => setForm(p => ({ ...p, contrata: [...keys][0] || '' }))}
                variant="bordered"
                radius="lg"
              >
                {CONTRATAS.map(c => (
                  <SelectItem key={c}>{c === 'IDERKA' ? 'Iderka' : 'Fonta'}</SelectItem>
                ))}
              </Select>
              <Input
                label="Legajo"
                placeholder="PE101L84"
                value={form.legajo}
                onValueChange={v => setForm(p => ({ ...p, legajo: normalizarLegajo(v) }))}
                variant="bordered"
                radius="lg"
              />
              <p className="text-xs text-default-500">
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

      {/* Aprobar / suspender / reactivar */}
      <Modal isOpen={Boolean(estadoPendiente)} onOpenChange={abierto => !abierto && setEstadoPendiente(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-foreground">
              {estadoPendiente?.estado === 'suspendido'
                ? 'Suspender usuario'
                : estadoPendiente?.usuario.estado === 'pendiente' ? 'Aprobar usuario' : 'Reactivar usuario'}
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                {estadoPendiente?.estado === 'suspendido' ? (
                  <>
                    <strong>{estadoPendiente && nombreDe(estadoPendiente.usuario)}</strong> perderá el acceso a la
                    aplicación y se cerrarán sus sesiones abiertas.
                  </>
                ) : (
                  <>
                    <strong>{estadoPendiente && nombreDe(estadoPendiente.usuario)}</strong> podrá usar la aplicación
                    con su legajo <span className="font-mono">{estadoPendiente?.usuario.legajo || '—'}</span>.
                  </>
                )}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={() => setEstadoPendiente(null)}>
                Cancelar
              </Button>
              <Button
                color={estadoPendiente?.estado === 'suspendido' ? 'danger' : 'primary'}
                radius="lg"
                onPress={confirmarEstado}
                isLoading={guardando}
              >
                Confirmar
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      {/* Eliminar cuenta / rechazar solicitud */}
      <Modal isOpen={Boolean(eliminando)} onOpenChange={abierto => !abierto && !guardando && setEliminando(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-danger">
              {eliminando?.estado === 'pendiente' ? 'Rechazar solicitud' : 'Eliminar cuenta'}
            </ModalHeader>
            <ModalBody className="space-y-3">
              <div className="flex gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  Esta acción es <strong>irreversible</strong>. Se eliminará la cuenta de{' '}
                  <strong>{eliminando && nombreDe(eliminando)}</strong>
                  {eliminando?.legajo && <> (<span className="font-mono">{eliminando.legajo}</span>)</>}
                  {eliminando?.estado !== 'pendiente' && (
                    <> junto con todos sus datos: listas de repuestos, pedidos, WOs importadas, almacén y
                    movimientos, y preferencias</>
                  )}
                  . Para volver a usar la aplicación tendría que registrarse de nuevo.
                </p>
              </div>
              {eliminando?.estado !== 'pendiente' && (
                <p className="text-xs text-default-500">
                  Si solo quieres quitarle el acceso sin perder su historial, usa «Suspender».
                </p>
              )}
              <Input
                label={`Escribe «${FRASE_ELIMINAR}» para confirmar`}
                value={fraseConfirmacion}
                onValueChange={setFraseConfirmacion}
                autoComplete="off"
                variant="bordered"
                radius="lg"
                color="danger"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={() => setEliminando(null)} isDisabled={guardando}>
                Cancelar
              </Button>
              <Button
                color="danger"
                radius="lg"
                onPress={confirmarEliminar}
                isLoading={guardando}
                isDisabled={fraseConfirmacion !== FRASE_ELIMINAR}
              >
                {eliminando?.estado === 'pendiente' ? 'Rechazar y eliminar' : 'Eliminar cuenta'}
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      {/* Reiniciar clave */}
      <Modal isOpen={Boolean(reiniciando)} onOpenChange={abierto => !abierto && setReiniciando(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-foreground">Reiniciar clave</ModalHeader>
            <ModalBody className="space-y-2">
              <p className="text-sm text-default-600">
                La contraseña actual de <strong>{reiniciando && nombreDe(reiniciando)}</strong> dejará de funcionar y se
                cerrarán sus sesiones. El usuario creará una nueva desde un enlace de un solo uso.
              </p>
              <p className="text-xs text-default-500">
                «Enviar correo» manda el enlace a {reiniciando?.email}. «Generar enlace» te lo muestra para que se lo
                compartas tú (el enlace anterior deja de valer cada vez que generas uno nuevo).
              </p>
            </ModalBody>
            <ModalFooter className="flex-wrap">
              <Button variant="light" radius="lg" onPress={() => setReiniciando(null)}>
                Cancelar
              </Button>
              <Button variant="flat" radius="lg" onPress={() => reiniciarClave(false)} isLoading={guardando}>
                Generar enlace
              </Button>
              <Button color="primary" radius="lg" onPress={() => reiniciarClave(true)} isLoading={guardando}>
                Enviar correo
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      {/* Enlace generado */}
      <Modal isOpen={Boolean(linkGenerado)} onOpenChange={abierto => !abierto && setLinkGenerado(null)}>
        <ModalContent>
          <>
            <ModalHeader className="text-foreground">Enlace de recuperación</ModalHeader>
            <ModalBody className="space-y-3">
              <p className="text-sm text-default-600">
                Comparte este enlace con <strong>{linkGenerado && nombreDe(linkGenerado.usuario)}</strong>. Es de un solo
                uso y caduca en poco tiempo.
              </p>
              <Input
                aria-label="Enlace de recuperación"
                value={linkGenerado?.link || ''}
                isReadOnly
                variant="bordered"
                radius="lg"
                size="sm"
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={() => setLinkGenerado(null)}>
                Cerrar
              </Button>
              <Button color="primary" radius="lg" startContent={<Copy size={15} />} onPress={copiarLink}>
                Copiar enlace
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      {/* Cambiar rol */}
      <Modal isOpen={Boolean(editandoUsuario)} onOpenChange={abierto => !abierto && cerrarCambioRol()}>
        <ModalContent>
          <>
            <ModalHeader className="text-foreground">Cambiar rol de usuario</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Cambiar el rol de <strong>{editandoUsuario && nombreDe(editandoUsuario)}</strong> de{' '}
                <strong>{editandoUsuario?.role}</strong> a <strong>{nuevoRol}</strong>?
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" radius="lg" onPress={cerrarCambioRol}>
                Cancelar
              </Button>
              <Button color="primary" radius="lg" onPress={confirmarCambioRol} isLoading={guardando}>
                Confirmar cambio
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

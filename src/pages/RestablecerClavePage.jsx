import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { validarClave, traducirErrorAuth } from '../lib/registro'
import { Card, CardBody, Input, Button, Spinner, Alert as HeroAlert } from '@heroui/react'

// Destino del link de recuperación que genera el admin con «Reiniciar clave».
// Supabase procesa el token de la URL y abre una sesión temporal.
export default function RestablecerClavePage() {
  const { session, authLoading, setRecuperandoClave, cerrarSesion } = useApp()
  const navigate = useNavigate()
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function guardar() {
    setError(null)
    const errClave = validarClave(clave, confirmacion)
    if (errClave) {
      setError(errClave)
      return
    }
    setCargando(true)
    const { error: errUpdate } = await supabase.auth.updateUser({ password: clave })
    if (errUpdate) {
      setError(traducirErrorAuth(errUpdate))
      setCargando(false)
      return
    }
    await supabase.rpc('completar_cambio_clave')
    await cerrarSesion()
    setRecuperandoClave(false)
    navigate('/login', { replace: true, state: { aviso: 'Contraseña creada. Ya puedes iniciar sesión.' } })
  }

  let contenido
  if (authLoading) {
    contenido = (
      <div className="flex items-center justify-center gap-3 py-6 text-sm text-default-500">
        <Spinner size="sm" /> Verificando enlace...
      </div>
    )
  } else if (!session) {
    contenido = (
      <div className="space-y-4">
        <HeroAlert
          color="warning"
          title="Enlace no válido"
          description="El enlace venció o ya fue usado. Pide al administrador que reinicie tu clave nuevamente."
        />
        <Link to="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    )
  } else {
    contenido = (
      <>
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={clave}
          onValueChange={setClave}
          variant="bordered"
          radius="lg"
        />
        <Input
          label="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onValueChange={setConfirmacion}
          variant="bordered"
          radius="lg"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button color="primary" radius="lg" className="min-h-11" onPress={guardar} isLoading={cargando}>
          Guardar contraseña
        </Button>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-nav px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center text-white">
          <p className="text-2xl font-bold tracking-[0.25em]">ATM·WO</p>
        </div>
        <Card shadow="lg" className="border border-default-200/70 bg-content1">
          <CardBody className="space-y-4 p-6">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold text-foreground">Crea tu contraseña</h1>
              <p className="text-sm text-default-500">
                El administrador reinició tu acceso. Define una contraseña nueva.
              </p>
            </div>
            {contenido}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

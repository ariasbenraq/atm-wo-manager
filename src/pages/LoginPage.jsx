import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import {
  Card,
  CardBody,
  Input,
  Button,
  Alert as HeroAlert,
} from '@heroui/react'

export default function LoginPage() {
  const { setSession } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  function validarFormulario() {
    const nuevosErrores = {}

    if (!username.trim()) nuevosErrores.usuario = 'El usuario es obligatorio.'
    if (!password.trim()) nuevosErrores.password = 'La contraseña es obligatoria.'

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function iniciarSesion() {
    setMensaje(null)

    if (!validarFormulario()) return

    setCargando(true)

    try {
      let email = username.trim()

      // Si no parece email, buscar username en profiles
      if (!email.includes('@')) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', email.trim())
          .maybeSingle()

        if (!perfil?.email) {
          setMensaje({ color: 'danger', texto: 'Usuario no encontrado.' })
          setCargando(false)
          return
        }
        email = perfil.email
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMensaje({ color: 'danger', texto: error.message })
        return
      }

      setSession(data.session ?? null)
      navigate('/tareas', { replace: true })
    } catch {
      setMensaje({ color: 'danger', texto: 'Error al conectar con el servidor.' })
    } finally {
      setCargando(false)
    }
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
                Ingresa con tu usuario o correo electrónico.
              </p>
            </div>

            <Input
              label="Usuario o correo"
              placeholder="ej. jperez"
              value={username}
              onValueChange={value => {
                setUsername(value)
                if (errores.usuario) setErrores(prev => ({ ...prev, usuario: undefined }))
              }}
              isInvalid={Boolean(errores.usuario)}
              errorMessage={errores.usuario}
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
              <HeroAlert
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

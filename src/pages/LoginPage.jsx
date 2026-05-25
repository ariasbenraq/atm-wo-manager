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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  function validarFormulario() {
    const nuevosErrores = {}

    if (!email.trim()) nuevosErrores.email = 'El correo es obligatorio.'
    if (!password.trim()) nuevosErrores.password = 'La contraseña es obligatoria.'

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function iniciarSesion() {
    setMensaje(null)

    if (!validarFormulario()) return

    setCargando(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setCargando(false)

    if (error) {
      setMensaje({ color: 'danger', texto: error.message })
      return
    }

    setSession(data.session ?? null)
    navigate('/tareas', { replace: true })
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
                Inicia sesión con tu cuenta para registrar y consultar repuestos en Supabase.
              </p>
            </div>

            <Input
              label="Correo"
              type="email"
              placeholder="tecnico@ncr.com"
              value={email}
              onValueChange={value => {
                setEmail(value)
                if (errores.email) setErrores(prev => ({ ...prev, email: undefined }))
              }}
              isInvalid={Boolean(errores.email)}
              errorMessage={errores.email}
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

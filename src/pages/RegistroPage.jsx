import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import {
  CONTRATAS,
  normalizarLegajo,
  LEGAJO_REGEX,
  validarClave,
  traducirErrorAuth,
} from '../lib/registro'
import {
  Card, CardBody, Input, Button, Select, SelectItem, Alert as HeroAlert,
} from '@heroui/react'

export default function RegistroPage() {
  const { setSession } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', contrata: '', legajo: '', clave: '', confirmacion: '',
  })
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  function cambiar(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    if (errores[campo]) setErrores(prev => ({ ...prev, [campo]: undefined }))
  }

  async function validar() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!form.apellido.trim()) e.apellido = 'El apellido es obligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Ingresa un correo válido.'
    if (!CONTRATAS.includes(form.contrata)) e.contrata = 'Selecciona tu contrata.'
    if (!LEGAJO_REGEX.test(form.legajo)) {
      e.legajo = 'Formato PE101L84 (Lima) o PE101R12 (Regiones).'
    }
    const errClave = validarClave(form.clave, form.confirmacion)
    if (errClave) e[form.clave.length < 8 ? 'clave' : 'confirmacion'] = errClave

    if (!e.legajo) {
      const { data: disponible } = await supabase.rpc('legajo_disponible', { p_legajo: form.legajo })
      if (disponible === false) e.legajo = 'Ese legajo ya está registrado.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function registrar() {
    setMensaje(null)
    setCargando(true)
    try {
      if (!(await validar())) return

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.clave,
        options: {
          data: {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            contrata: form.contrata,
            legajo: form.legajo,
          },
        },
      })

      if (error) {
        setMensaje({ color: 'danger', texto: traducirErrorAuth(error) })
        return
      }

      // Sin confirmación de correo, signUp devuelve sesión: el Layout mostrará
      // la pantalla «pendiente de aprobación».
      if (data.session) {
        setSession(data.session)
        navigate('/inicio', { replace: true })
      } else {
        setMensaje({
          color: 'success',
          texto: 'Cuenta creada. Un administrador debe aprobarla antes de que puedas usar la aplicación.',
        })
      }
    } catch {
      setMensaje({ color: 'danger', texto: 'Error al conectar con el servidor.' })
    } finally {
      setCargando(false)
    }
  }

  const campo = (clave, label, extra = {}) => (
    <Input
      label={label}
      value={form[clave]}
      onValueChange={v => cambiar(clave, extra.transformar ? extra.transformar(v) : v)}
      isInvalid={Boolean(errores[clave])}
      errorMessage={errores[clave]}
      variant="bordered"
      radius="lg"
      {...extra.props}
    />
  )

  return (
    <div className="min-h-screen bg-nav px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center text-white">
          <p className="text-2xl font-bold tracking-[0.25em]">ATM·WO</p>
          <p className="mt-1 text-sm text-white/60">Órdenes de trabajo y almacén</p>
        </div>
        <Card shadow="lg" className="border border-default-200/70 bg-content1">
          <CardBody className="space-y-4 p-6">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold text-foreground">Crear cuenta</h1>
              <p className="text-sm text-default-500">
                Un administrador revisará tu solicitud antes de activar el acceso.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {campo('nombre', 'Nombre', { props: { autoComplete: 'given-name' } })}
              {campo('apellido', 'Apellido', { props: { autoComplete: 'family-name' } })}
            </div>
            {campo('email', 'Correo electrónico', { props: { type: 'email', autoComplete: 'email' } })}

            <Select
              label="Contrata"
              selectedKeys={form.contrata ? [form.contrata] : []}
              onSelectionChange={keys => cambiar('contrata', [...keys][0] || '')}
              isInvalid={Boolean(errores.contrata)}
              errorMessage={errores.contrata}
              variant="bordered"
              radius="lg"
            >
              {CONTRATAS.map(c => (
                <SelectItem key={c}>{c === 'IDERKA' ? 'Iderka' : 'Fonta'}</SelectItem>
              ))}
            </Select>

            {campo('legajo', 'Legajo', {
              transformar: normalizarLegajo,
              props: { placeholder: 'PE101L84', classNames: { input: 'font-mono' } },
            })}
            {campo('clave', 'Contraseña', { props: { type: 'password', autoComplete: 'new-password' } })}
            {campo('confirmacion', 'Repetir contraseña', {
              props: { type: 'password', autoComplete: 'new-password' },
            })}

            <Button color="primary" radius="lg" className="min-h-11" onPress={registrar} isLoading={cargando}>
              Registrarme
            </Button>

            {mensaje && (
              <HeroAlert
                color={mensaje.color}
                title={mensaje.color === 'success' ? 'Solicitud enviada' : 'No se pudo registrar'}
                description={mensaje.texto}
              />
            )}

            <p className="text-center text-sm text-default-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">Ingresar</Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

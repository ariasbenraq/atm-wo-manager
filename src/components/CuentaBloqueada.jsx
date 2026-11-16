import { Button } from '@heroui/react'
import { Clock, Ban } from 'lucide-react'

// Pantalla que reemplaza a la app cuando la cuenta está pendiente o suspendida.
export default function CuentaBloqueada({ estado, nombre, onSalir }) {
  const suspendida = estado === 'suspendido'
  const Icono = suspendida ? Ban : Clock

  return (
    <div className="flex min-h-screen items-center justify-center bg-nav px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-default-200/70 bg-content1 p-6 text-center shadow-lg">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${suspendida ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-700'}`}>
          <Icono size={22} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          {suspendida ? 'Cuenta suspendida' : 'Cuenta pendiente de aprobación'}
        </h1>
        <p className="text-sm text-default-500">
          {suspendida
            ? 'Tu acceso a la aplicación fue suspendido. Contacta al administrador para más información.'
            : `${nombre ? `${nombre}, tu` : 'Tu'} solicitud fue recibida. Un administrador debe aprobarla antes de que puedas usar la aplicación.`}
        </p>
        <Button variant="flat" radius="lg" className="min-h-11" onPress={onSalir}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}

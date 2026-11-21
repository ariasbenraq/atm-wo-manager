import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { esModoDemo } from '../lib/demo/modoDemo'

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
}

export const PERMISSIONS = {
  repuestos: {
    ver: ['admin', 'user'],
    crear: ['admin'],
    editar: ['admin'],
    eliminar: ['admin'],
  },
  listas: {
    verTodas: ['admin'],
    verPropias: ['admin', 'user'],
    crear: ['admin', 'user'],
    editar: ['admin', 'user'],
    eliminar: ['admin', 'user'],
  },
  usuarios: {
    administrar: ['admin'],
  },
}

export function useRole() {
  const { profile } = useApp()
  return profile?.role || null
}

export function useIsAdmin() {
  const role = useRole()
  return role === ROLES.ADMIN
}

export function useCan(accion, recurso) {
  const role = useRole()
  return useMemo(() => {
    if (!role) return false
    const rolesPermitidos = PERMISSIONS[recurso]?.[accion]
    if (!rolesPermitidos) return false
    return rolesPermitidos.includes(role)
  }, [role, accion, recurso])
}



// Importar/crear/editar/eliminar WOs: solo admin, y la cuenta demo (sus datos viven en memoria,
// nunca llegan a la base de datos).
export function usePuedeGestionarWos() {
  const esAdmin = useIsAdmin()
  return esAdmin || esModoDemo()
}

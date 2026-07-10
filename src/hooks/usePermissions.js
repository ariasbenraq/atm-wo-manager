import { useMemo } from 'react'
import { useApp } from '../context/AppContext'

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
}

export const PERMISSIONS = {
  repuestos: {
    ver: ['admin', 'user'],
    crear: ['admin', 'user'],
    editar: ['admin', 'user'],
    eliminar: ['admin', 'user'],
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



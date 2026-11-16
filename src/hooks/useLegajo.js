import { useApp } from '../context/AppContext'

// Legajo asignado al usuario actual (vacío si el administrador aún no lo asignó)
export function useLegajo() {
  const { profile } = useApp()
  return String(profile?.legajo || '').replace(/\s+/g, '').toUpperCase()
}

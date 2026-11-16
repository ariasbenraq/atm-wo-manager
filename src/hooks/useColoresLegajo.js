import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { cargarPreferencia, guardarPreferencia } from '../lib/preferencias'
import { COLORES_POR_DEFECTO } from '../lib/coloresTarjeta'

const CLAVE = 'colores_legajo'

// Colores de fondo elegidos por el usuario para Lima y Regiones
export function useColoresLegajo() {
  const { session } = useApp()
  const userId = session?.user?.id
  const [colores, setColores] = useState(COLORES_POR_DEFECTO)
  const actual = useRef(colores)

  useEffect(() => {
    if (!userId) return
    let activo = true
    cargarPreferencia(userId, CLAVE).then(v => {
      if (!activo || !v) return
      const nuevos = { ...COLORES_POR_DEFECTO, ...v }
      actual.current = nuevos
      setColores(nuevos)
    })
    return () => { activo = false }
  }, [userId])

  const aplicar = useCallback(nuevos => {
    actual.current = nuevos
    setColores(nuevos)
    guardarPreferencia(userId, CLAVE, nuevos)
  }, [userId])

  const cambiar = useCallback((grupo, clave) => aplicar({ ...actual.current, [grupo]: clave }), [aplicar])
  const restablecer = useCallback(() => aplicar(COLORES_POR_DEFECTO), [aplicar])

  return { colores, cambiar, restablecer }
}

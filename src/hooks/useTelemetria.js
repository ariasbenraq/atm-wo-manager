import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { iniciarTelemetria, detenerTelemetria, registrarEvento } from '../lib/telemetria'

// Activa la telemetría mientras haya sesión y registra vistas de página y permanencia.
export function useTelemetria(activa) {
  const { pathname } = useLocation()
  const entrada = useRef(null)

  useEffect(() => {
    if (!activa) return undefined
    iniciarTelemetria()
    return () => detenerTelemetria()
  }, [activa])

  useEffect(() => {
    if (!activa) return undefined
    registrarEvento('vista', pathname, { ruta: pathname })
    entrada.current = performance.now()
    return () => {
      const ms = performance.now() - (entrada.current ?? performance.now())
      if (ms >= 1000) registrarEvento('permanencia', pathname, { ruta: pathname, duracion_ms: ms })
    }
  }, [activa, pathname])
}

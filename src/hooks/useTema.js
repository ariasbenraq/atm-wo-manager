import { useState, useEffect, useCallback } from 'react'
import { TEMAS, leerTema, guardarTema, aplicarTema } from '../lib/tema'

export const ETIQUETA_TEMA = { sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' }

export function useTema() {
  const [tema, setTema] = useState(leerTema)

  // Con «sistema», seguir los cambios del dispositivo
  useEffect(() => {
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => aplicarTema('sistema')
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [tema])

  const alternar = useCallback(() => {
    setTema(actual => {
      const siguiente = TEMAS[(TEMAS.indexOf(actual) + 1) % TEMAS.length]
      guardarTema(siguiente)
      return siguiente
    })
  }, [])

  return { tema, alternar }
}

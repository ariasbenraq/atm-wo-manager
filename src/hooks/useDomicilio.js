import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { cargarPreferencia, guardarPreferencia } from '../lib/preferencias'

const CLAVE = 'movilidad_domicilio'
const VACIO = { distrito: '', direccion: '' }

// Domicilio del técnico (punto inicial y final de la jornada), guardado en sus preferencias
export function useDomicilio() {
  const { session } = useApp()
  const userId = session?.user?.id
  const [domicilio, setDomicilio] = useState(VACIO)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    if (!userId) return
    let activo = true
    cargarPreferencia(userId, CLAVE).then(v => {
      if (!activo) return
      if (v && typeof v === 'object') setDomicilio({ ...VACIO, distrito: v.distrito || '', direccion: v.direccion || '' })
      setCargado(true)
    })
    return () => { activo = false }
  }, [userId])

  const guardar = useCallback(nuevo => {
    const limpio = { distrito: String(nuevo.distrito || '').trim(), direccion: String(nuevo.direccion || '').trim() }
    setDomicilio(limpio)
    return guardarPreferencia(userId, CLAVE, limpio)
  }, [userId])

  return { domicilio, guardar, cargado }
}

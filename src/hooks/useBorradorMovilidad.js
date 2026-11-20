import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { cargarPreferencia, guardarPreferencia } from '../lib/preferencias'

const CLAVE_EDICIONES = 'movilidad_ediciones'
const CLAVE_INFORMES = 'movilidad_informes'
const DIAS_CONSERVAR = 60
const ESPERA_MS = 800

function limite() {
  return new Date(Date.now() - DIAS_CONSERVAR * 86400000).toISOString().slice(0, 10)
}

function podarEdiciones(obj) {
  const min = limite()
  return Object.fromEntries(Object.entries(obj).filter(([clave]) => clave.slice(0, 10) >= min))
}

function podarInformes(obj) {
  const min = limite()
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => (v?.fecha || '') >= min))
}

// Borrador de Movilidades: lo que el técnico edita en cada tramo (por fecha) y el N° de informe por WO.
// Se guarda solo (en su cuenta y en este dispositivo) para que no se pierda al cambiar de fecha o recargar.
export function useBorradorMovilidad() {
  const { session } = useApp()
  const userId = session?.user?.id
  const [ediciones, setEdiciones] = useState({})
  const [informes, setInformes] = useState({})
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const actual = useRef({ ediciones: {}, informes: {} })
  const pendiente = useRef({ ediciones: false, informes: false })
  const temporizador = useRef(null)

  useEffect(() => {
    if (!userId) return
    let activo = true
    Promise.all([cargarPreferencia(userId, CLAVE_EDICIONES), cargarPreferencia(userId, CLAVE_INFORMES)]).then(([e, i]) => {
      if (!activo) return
      // Lo editado mientras cargaba tiene prioridad sobre lo guardado
      const ed = { ...podarEdiciones(e && typeof e === 'object' ? e : {}), ...actual.current.ediciones }
      const inf = { ...podarInformes(i && typeof i === 'object' ? i : {}), ...actual.current.informes }
      actual.current = { ediciones: ed, informes: inf }
      setEdiciones(ed)
      setInformes(inf)
      setCargado(true)
    })
    return () => { activo = false }
  }, [userId])

  const volcar = useCallback(async () => {
    clearTimeout(temporizador.current)
    temporizador.current = null
    const { ediciones: e, informes: i } = pendiente.current
    pendiente.current = { ediciones: false, informes: false }
    if (!userId || (!e && !i)) return
    setGuardando(true)
    try {
      if (e) await guardarPreferencia(userId, CLAVE_EDICIONES, podarEdiciones(actual.current.ediciones))
      if (i) await guardarPreferencia(userId, CLAVE_INFORMES, podarInformes(actual.current.informes))
    } finally {
      setGuardando(false)
    }
  }, [userId])

  const programar = useCallback(() => {
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(volcar, ESPERA_MS)
  }, [volcar])

  // Al salir de la página o cerrar la pestaña se guarda de inmediato
  useEffect(() => {
    const alSalir = () => { volcar() }
    window.addEventListener('pagehide', alSalir)
    return () => {
      window.removeEventListener('pagehide', alSalir)
      volcar()
    }
  }, [volcar])

  const cambiarTramo = useCallback((clave, cambio) => {
    const nuevo = { ...actual.current.ediciones, [clave]: { ...actual.current.ediciones[clave], ...cambio } }
    actual.current.ediciones = nuevo
    pendiente.current.ediciones = true
    setEdiciones(nuevo)
    programar()
  }, [programar])

  const cambiarInforme = useCallback((wo, informe, fecha) => {
    const nuevo = { ...actual.current.informes, [wo]: { informe, fecha } }
    actual.current.informes = nuevo
    pendiente.current.informes = true
    setInformes(nuevo)
    programar()
  }, [programar])

  return { ediciones, informes, cargado, guardando, cambiarTramo, cambiarInforme }
}

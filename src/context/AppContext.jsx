import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { syncFromSupabase } from '../lib/sync'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [tareas, setTareas] = useState([])
  const [misTareas, setMisTareas] = useState([])
  const [syncing, setSyncing] = useState(true)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [creandoTarea, setCreandoTarea] = useState(false)

  const cargarTareas = useCallback(async () => {
    const local = await db.tareas.toArray()
    setTareas(local)
  }, [])

  const cargarMisTareas = useCallback(async () => {
    const local = await db.mis_tareas.toArray()
    setMisTareas(local)
  }, [])

  function construirPayloadMisTarea(tarea, userId) {
    return {
      user_id: userId,
      tarea_wo: tarea.wo,
      estado: tarea.estado || 'pendiente',
      completada_at: tarea.completadaEn || null,
      ds: tarea.ds || null,
      arribo: tarea.arribo || null,
      inicio: tarea.inicio || null,
      fin: tarea.fin || null,
      retorno: tarea.retorno || null,
      tiempos_updated_at: tarea.tiemposUpdatedAt || null,
    }
  }

  const marcarTiemposSincronizados = useCallback(async (wo, tiemposSyncPendiente) => {
    await db.mis_tareas.where('wo').equals(wo).modify({ tiemposSyncPendiente })
    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo ? { ...tarea, tiemposSyncPendiente } : tarea
    )))
  }, [])

  const sincronizarTiemposPendientes = useCallback(async (userId) => {
    if (!userId) return

    const pendientes = await db.mis_tareas
      .filter(tarea => Boolean(tarea.tiemposSyncPendiente))
      .toArray()

    for (const tarea of pendientes) {
      try {
        const { error } = await supabase
          .from('mis_tareas')
          .upsert(construirPayloadMisTarea(tarea, userId), {
            onConflict: 'user_id,tarea_wo',
          })

        if (error) throw error
        await marcarTiemposSincronizados(tarea.wo, false)
      } catch (error) {
        console.warn(`No se pudo sincronizar los tiempos de la tarea ${tarea.wo}.`, error)
      }
    }
  }, [marcarTiemposSincronizados])

  const agregarAMisTareas = useCallback(async (tarea) => {
    if (!tarea?.wo) return

    const existente = await db.mis_tareas.where('wo').equals(tarea.wo).first()
    if (existente) return

    const tareaPendiente = {
      ...tarea,
      estado: 'pendiente',
      completadaEn: null,
      ds: null,
      arribo: null,
      inicio: null,
      fin: null,
      retorno: null,
      tiemposUpdatedAt: null,
      tiemposSyncPendiente: false,
    }

    await db.mis_tareas.add(tareaPendiente)
    setMisTareas(prev => [tareaPendiente, ...prev])

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .upsert(construirPayloadMisTarea(tareaPendiente, session.user.id), {
          onConflict: 'user_id,tarea_wo',
        })

      if (error && error.code !== '23505') {
        throw error
      }
    } catch (error) {
      console.warn('No se pudo guardar la tarea en Supabase.', error)
    }
  }, [session])

  const marcarTareaCompletada = useCallback(async (wo) => {
    if (!wo) return

    const completadaEn = new Date().toISOString()

    await db.mis_tareas.where('wo').equals(wo).modify({
      estado: 'completada',
      completadaEn,
    })

    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo ? { ...tarea, estado: 'completada', completadaEn } : tarea
    )))

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .update({
          estado: 'completada',
          completada_at: completadaEn,
        })
        .eq('user_id', session.user.id)
        .eq('tarea_wo', wo)

      if (error) throw error
    } catch (error) {
      console.warn('No se pudo actualizar la tarea en Supabase.', error)
    }
  }, [session])

  const eliminarDeMisTareas = useCallback(async (wo) => {
    if (!wo) return

    await db.mis_tareas.where('wo').equals(wo).delete()
    setMisTareas(prev => prev.filter(tarea => tarea.wo !== wo))

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .delete()
        .eq('user_id', session.user.id)
        .eq('tarea_wo', wo)

      if (error) throw error
    } catch (error) {
      console.warn('No se pudo eliminar la tarea en Supabase.', error)
    }
  }, [session])

  const guardarTiemposMisTarea = useCallback(async (wo, cambios) => {
    if (!wo) return

    const tareaActual = await db.mis_tareas.where('wo').equals(wo).first()
    if (!tareaActual) return

    const tiemposUpdatedAt = new Date().toISOString()
    const tareaActualizada = {
      ...tareaActual,
      ...cambios,
      tiemposUpdatedAt,
      tiemposSyncPendiente: true,
    }

    await db.mis_tareas.where('wo').equals(wo).modify({
      ...cambios,
      tiemposUpdatedAt,
      tiemposSyncPendiente: true,
    })

    setMisTareas(prev => prev.map(tarea => (
      tarea.wo === wo
        ? { ...tarea, ...cambios, tiemposUpdatedAt, tiemposSyncPendiente: true }
        : tarea
    )))

    if (!session?.user?.id) return

    try {
      const { error } = await supabase
        .from('mis_tareas')
        .upsert(construirPayloadMisTarea(tareaActualizada, session.user.id), {
          onConflict: 'user_id,tarea_wo',
        })

      if (error) throw error
      await marcarTiemposSincronizados(wo, false)
    } catch (error) {
      console.warn(`No se pudo guardar en Supabase los tiempos de la tarea ${wo}.`, error)
    }
  }, [session, marcarTiemposSincronizados])

  const crearTareaManual = useCallback(async (tarea) => {
    const wo = String(tarea?.wo || '').trim()
    if (!wo) {
      throw new Error('La WO es obligatoria.')
    }

    setCreandoTarea(true)

    try {
      const existente = await db.tareas.where('wo').equals(wo).first()
      if (existente) {
        throw new Error(`La WO ${wo} ya existe.`)
      }

      const nuevaTarea = {
        wo,
        modelo: String(tarea?.modelo || '').trim(),
        serie: String(tarea?.serie || '').trim(),
        id_atm: String(tarea?.id_atm || '').trim(),
        nombre: String(tarea?.nombre || '').trim(),
        direccion: String(tarea?.direccion || '').trim(),
        distrito: String(tarea?.distrito || '').trim(),
        fecha: String(tarea?.fecha || '').trim(),
        hora: String(tarea?.hora || '').trim(),
        ce: String(tarea?.ce || '').trim(),
      }

      const { error } = await supabase
        .from('tareas')
        .upsert(nuevaTarea, { onConflict: 'wo' })

      if (error) throw error

      await db.tareas.add(nuevaTarea)
      setTareas(prev => [nuevaTarea, ...prev])
    } finally {
      setCreandoTarea(false)
    }
  }, [setCreandoTarea, setTareas])

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  useEffect(() => {
    let activo = true

    async function initAuth() {
      const { data } = await supabase.auth.getSession()
      if (!activo) return
      setSession(data.session ?? null)
      setAuthLoading(false)
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      if (!activo) return
      setSession(nuevaSession ?? null)
    })

    return () => {
      activo = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function init() {
      setSyncing(true)
      await cargarTareas()
      await cargarMisTareas()
      await syncFromSupabase(session.user.id)
      await sincronizarTiemposPendientes(session.user.id)
      await syncFromSupabase(session.user.id)
      await cargarTareas()
      await cargarMisTareas()
      setSyncing(false)
    }

    if (session) {
      init()
    } else {
      setSyncing(false)
    }
  }, [session, sincronizarTiemposPendientes, cargarTareas, cargarMisTareas])

  const value = useMemo(() => ({
    tareas,
    misTareas,
    syncing,
    session,
    authLoading,
    creandoTarea,
    setTareas,
    setMisTareas,
    setSession,
    setCreandoTarea,
    cargarTareas,
    cargarMisTareas,
    agregarAMisTareas,
    marcarTareaCompletada,
    eliminarDeMisTareas,
    guardarTiemposMisTarea,
    crearTareaManual,
    cerrarSesion,
  }), [
    tareas, misTareas, syncing, session, authLoading, creandoTarea,
    cargarTareas, cargarMisTareas, agregarAMisTareas, marcarTareaCompletada,
    eliminarDeMisTareas, guardarTiemposMisTarea, crearTareaManual, cerrarSesion,
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de un AppProvider')
  return ctx
}

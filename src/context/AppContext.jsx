import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { syncFromSupabase } from '../lib/sync'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [syncing, setSyncing] = useState(true)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [sesionExpirada, setSesionExpirada] = useState(false)
  const [profile, setProfile] = useState(null)
  // En /restablecer-clave la sesión es temporal (link de recuperación): no se
  // carga el perfil ni se sincroniza (sync.js vacía las tablas locales).
  const [recuperandoClave, setRecuperandoClave] = useState(
    () => window.location.pathname.startsWith('/restablecer-clave')
  )
  const cierreManualRef = useRef(false)

  const cerrarSesion = useCallback(async () => {
    cierreManualRef.current = true
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nuevaSession) => {
      if (!activo) return

      if ((event === 'SIGNED_OUT' || event === 'USER_DELETED') && !cierreManualRef.current) {
        setSesionExpirada(true)
      }
      if (event === 'PASSWORD_RECOVERY') setRecuperandoClave(true)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (nuevaSession) {
          setSesionExpirada(false)
        }
      }
      cierreManualRef.current = false

      setSession(nuevaSession ?? null)
    })

    return () => {
      activo = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const cargarProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!error && data) {
        setProfile(data)
        return data
      }
    } catch {
      // se usa el perfil mínimo de abajo
    }
    const minimo = { id: userId, role: 'user' }
    setProfile(minimo)
    return minimo
  }, [])

  useEffect(() => {
    async function init() {
      setSyncing(true)
      const perfil = await cargarProfile(session.user.id)
      // Cuentas pendientes o suspendidas no sincronizan (las bloquea la RLS)
      if (!perfil?.estado || perfil.estado === 'activo') {
        await syncFromSupabase(session.user.id)
      }
      setSyncing(false)
    }

    if (session && !recuperandoClave) {
      init()
    } else {
      // Sin sesión: limpiar perfil y estado de sincronización
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null)
      setSyncing(false)
    }
  }, [session, cargarProfile, recuperandoClave])

  const value = useMemo(() => ({
    syncing,
    session,
    authLoading,
    sesionExpirada,
    profile,
    recuperandoClave,
    setRecuperandoClave,
    setSession,
    cerrarSesion,
  }), [syncing, session, authLoading, sesionExpirada, profile, recuperandoClave, cerrarSesion])

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

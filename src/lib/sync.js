import { refrescarCacheWos } from './wosCache'

// Al iniciar sesión se refresca la copia local de las WOs (el resto de pantallas leen de Supabase
// y, sin conexión, de su propia copia en Dexie).
export async function syncFromSupabase(userId) {
  if (!userId) return
  try {
    await refrescarCacheWos()
  } catch (err) {
    console.warn('WO: sin conexión, se conserva el caché local', err)
  }
}

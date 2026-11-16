import { supabase } from './supabase'

// Preferencias por usuario: se guardan en Supabase (siguen al usuario entre dispositivos) y se copian
// en este dispositivo, así funcionan sin conexión. Si guardar falla, queda «pendiente» y se reintenta
// la próxima vez que se carga.
const CLAVE_LOCAL = (userId, clave) => `pref:${userId}:${clave}`

function leerLocal(userId, clave) {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL(userId, clave)) || 'null')
  } catch {
    return null
  }
}

function escribirLocal(userId, clave, valor, pendiente) {
  try {
    localStorage.setItem(CLAVE_LOCAL(userId, clave), JSON.stringify({ valor, pendiente }))
  } catch { /* sin almacenamiento disponible */ }
}

async function subir(userId, clave, valor) {
  const { error } = await supabase
    .from('preferencias_usuario')
    .upsert({ user_id: userId, clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'user_id,clave' })
  if (error) throw error
}

export async function guardarPreferencia(userId, clave, valor) {
  if (!userId) return
  escribirLocal(userId, clave, valor, true)
  try {
    await subir(userId, clave, valor)
    escribirLocal(userId, clave, valor, false)
  } catch { /* se reintenta al volver a cargar */ }
}

export async function cargarPreferencia(userId, clave) {
  if (!userId) return null
  const local = leerLocal(userId, clave)
  if (local?.pendiente) {
    try {
      await subir(userId, clave, local.valor)
      escribirLocal(userId, clave, local.valor, false)
    } catch { /* sigue pendiente */ }
    return local.valor
  }
  try {
    const { data, error } = await supabase
      .from('preferencias_usuario')
      .select('valor')
      .eq('user_id', userId)
      .eq('clave', clave)
      .maybeSingle()
    if (error) throw error
    if (data) {
      escribirLocal(userId, clave, data.valor, false)
      return data.valor
    }
    return local?.valor ?? null
  } catch {
    return local?.valor ?? null
  }
}

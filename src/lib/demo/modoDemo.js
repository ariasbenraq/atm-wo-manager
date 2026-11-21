// Modo demostración: cuenta de prueba que NUNCA toca Supabase.
// Al entrar con estas credenciales, `supabase` (src/lib/supabase.js) pasa a un cliente en memoria
// (clienteDemo.js): todo lo que se registre vive solo en esta pestaña (sessionStorage) y desaparece
// al salir o cerrar la pestaña. No se crea ningún usuario real ni se escribe en la base de datos.
import { db } from '../db'

export const DEMO_USUARIO = 'demo'
export const DEMO_CLAVE = 'Demo2026'
export const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d3a0'

const CLAVE_FLAG = 'atm_demo'
const CLAVE_DB = 'atm_demo_db'

export const DEMO_PERFIL = {
  id: DEMO_USER_ID,
  email: 'demo@atm-wo.demo',
  username: DEMO_USUARIO,
  full_name: 'Usuario Demo',
  nombre: 'Usuario',
  apellido: 'Demo',
  role: 'user',
  estado: 'activo',
  legajo: 'PE101L84',
  contrata: 'IDERKA',
  zona: 'LIMA',
}

export const DEMO_SESION = {
  access_token: 'demo',
  user: { id: DEMO_USER_ID, email: DEMO_PERFIL.email },
}

export function esModoDemo() {
  try {
    return sessionStorage.getItem(CLAVE_FLAG) === '1'
  } catch {
    return false
  }
}

export function esCredencialDemo(usuario, clave) {
  const u = String(usuario || '').trim().toLowerCase()
  return (u === DEMO_USUARIO || u === DEMO_PERFIL.email) && clave === DEMO_CLAVE
}

export function activarModoDemo() {
  try {
    sessionStorage.removeItem(CLAVE_DB)
    sessionStorage.setItem(CLAVE_FLAG, '1')
  } catch { /* sin almacenamiento: el modo no se puede activar */ }
}

export function leerBaseGuardada() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_DB) || 'null')
  } catch {
    return null
  }
}

export function guardarBase(base) {
  try {
    sessionStorage.setItem(CLAVE_DB, JSON.stringify(base))
  } catch { /* demasiado grande o sin almacenamiento: queda solo en memoria */ }
}

// Borra todo rastro de la demo en este navegador: sessionStorage, preferencias y cachés locales.
export async function salirModoDemo() {
  try {
    sessionStorage.removeItem(CLAVE_FLAG)
    sessionStorage.removeItem(CLAVE_DB)
    const borrar = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(`pref:${DEMO_USER_ID}:`) || k === 'wos_nombres_tecnicos')) borrar.push(k)
    }
    borrar.forEach(k => localStorage.removeItem(k))
  } catch { /* nada que limpiar */ }
  try {
    // Solo filas de la demo (u orígenes locales sin dueño): no se tocan datos de usuarios reales
    await db.workorders.clear()
    for (const tabla of db.tables) {
      if (tabla.name === 'workorders') continue
      await tabla.filter(r => r.userId === DEMO_USER_ID || r.user_id === DEMO_USER_ID).delete()
    }
  } catch { /* IndexedDB no disponible */ }
}

// Telemetría ligera de uso: vistas, permanencia, clics, errores y llamadas API
// fallidas o lentas. Se envía por lotes a `eventos_uso` (solo el administrador la lee).
// Nunca debe romper la app: todo va en try/catch y los fallos se descartan.
import { supabase } from './supabase'

const MAX_COLA = 200
const LOTE = 50
const INTERVALO_MS = 10000
const LENTA_MS = 2000

let cola = []
let activa = false
let temporizador = null
let sesionId = null

function obtenerSesion() {
  if (sesionId) return sesionId
  try {
    sesionId = sessionStorage.getItem('telemetria_sesion')
    if (!sesionId) {
      sesionId = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2))
      sessionStorage.setItem('telemetria_sesion', sesionId)
    }
  } catch {
    sesionId = String(Date.now()) + Math.random().toString(36).slice(2)
  }
  return sesionId
}

function dispositivo() {
  try {
    return window.matchMedia('(max-width: 767px)').matches ? 'movil' : 'escritorio'
  } catch {
    return null
  }
}

function recortar(texto, max = 200) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function registrarEvento(tipo, nombre, extra = {}) {
  if (!activa || !nombre) return
  if (cola.length >= MAX_COLA) cola.shift()
  cola.push({
    tipo,
    nombre: recortar(nombre),
    ruta: recortar(extra.ruta ?? window.location.pathname, 120),
    detalle: extra.detalle ?? null,
    duracion_ms: extra.duracion_ms != null ? Math.round(extra.duracion_ms) : null,
    sesion_id: obtenerSesion(),
    dispositivo: dispositivo(),
  })
}

export const registrarAccion = (nombre, detalle) => registrarEvento('accion', nombre, { detalle })

export async function vaciarCola() {
  if (!activa || !cola.length) return
  const lote = cola.splice(0, LOTE)
  try {
    const { error } = await supabase.from('eventos_uso').insert(lote)
    if (error) throw error
  } catch {
    // Telemetría descartable: no se reintenta para no acumular
  }
  if (cola.length) vaciarCola()
}

function alOcultar() {
  if (document.visibilityState === 'hidden') vaciarCola()
}

function alError(e) {
  registrarEvento('error', e.message || 'Error de JavaScript', {
    detalle: { archivo: recortar(e.filename, 120), linea: e.lineno || null },
  })
}

function alRechazo(e) {
  const r = e.reason
  registrarEvento('error', r?.message || String(r || 'Promesa rechazada'), { detalle: { promesa: true } })
}

function alClic(e) {
  const el = e.target?.closest?.('button, a, [role="button"], [role="tab"], [role="menuitem"]')
  if (!el) return
  const etiqueta = recortar(el.getAttribute('aria-label') || el.textContent, 40)
  if (etiqueta) registrarEvento('accion', etiqueta)
}

export function iniciarTelemetria() {
  if (activa) return
  activa = true
  temporizador = setInterval(vaciarCola, INTERVALO_MS)
  document.addEventListener('visibilitychange', alOcultar)
  window.addEventListener('pagehide', vaciarCola)
  window.addEventListener('error', alError)
  window.addEventListener('unhandledrejection', alRechazo)
  document.addEventListener('click', alClic, true)
}

export function detenerTelemetria() {
  if (!activa) return
  vaciarCola()
  activa = false
  cola = []
  clearInterval(temporizador)
  document.removeEventListener('visibilitychange', alOcultar)
  window.removeEventListener('pagehide', vaciarCola)
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  document.removeEventListener('click', alClic, true)
}

// fetch para el cliente de Supabase: registra solo llamadas fallidas o lentas
// (no las propias de telemetría) para no multiplicar el tráfico.
export async function fetchConTelemetria(entrada, init) {
  const url = typeof entrada === 'string' ? entrada : entrada?.url || ''
  const inicio = performance.now()
  const propia = url.includes('/rest/v1/eventos_uso')
  try {
    const resp = await fetch(entrada, init)
    if (!propia && activa) {
      const ms = performance.now() - inicio
      if (resp.status >= 400 || ms >= LENTA_MS) {
        registrarEvento('api', nombreApi(url, init?.method), { duracion_ms: ms, detalle: { status: resp.status } })
      }
    }
    return resp
  } catch (err) {
    if (!propia && activa) {
      registrarEvento('api', nombreApi(url, init?.method), {
        duracion_ms: performance.now() - inicio,
        detalle: { status: null, error: recortar(err?.message, 100) },
      })
    }
    throw err
  }
}

function nombreApi(url, metodo = 'GET') {
  try {
    const { pathname } = new URL(url)
    const m = pathname.match(/\/(rest|auth|functions)\/v1\/(.+)$/)
    const recurso = m ? `${m[1]}/${m[2].split('/')[0]}` : pathname
    return `${String(metodo).toUpperCase()} ${recurso}`
  } catch {
    return `${String(metodo).toUpperCase()} desconocida`
  }
}

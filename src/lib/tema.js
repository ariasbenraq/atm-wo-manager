// Tema de la interfaz: 'claro' | 'oscuro' | 'sistema'. Se guarda en este dispositivo.
const CLAVE = 'tema'
export const TEMAS = ['sistema', 'claro', 'oscuro']

export function leerTema() {
  try {
    const t = localStorage.getItem(CLAVE)
    return TEMAS.includes(t) ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function aplicarTema(tema) {
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', oscuro)
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light'
}

export function guardarTema(tema) {
  try { localStorage.setItem(CLAVE, tema) } catch { /* sin almacenamiento disponible */ }
  aplicarTema(tema)
}

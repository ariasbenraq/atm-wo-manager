// Validaciones y normalizadores compartidos por el registro y la administración.

export const CONTRATAS = ['IDERKA', 'FONTA']

// Lima: PE101L84 · Regiones: PE101R12 (mismo patrón que valida el trigger SQL)
export const LEGAJO_REGEX = /^PE\d{3}[LR]\d+$/

export const CLAVE_MIN = 8

export function normalizarLegajo(valor) {
  return String(valor || '').replace(/\s+/g, '').toUpperCase()
}

export function validarClave(clave, confirmacion) {
  if (clave.length < CLAVE_MIN) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`
  if (clave !== confirmacion) return 'Las contraseñas no coinciden.'
  return null
}

export function traducirErrorAuth(error) {
  const msg = String(error?.message || error || '')
  if (/already registered|already been registered/i.test(msg)) return 'Ese correo ya está registrado.'
  if (/banned/i.test(msg)) return 'Tu cuenta está suspendida. Contacta al administrador.'
  if (/email not confirmed/i.test(msg)) {
    return 'Tu correo aún no está confirmado. Pide al administrador que revise la configuración de la cuenta.'
  }
  if (/invalid login credentials/i.test(msg)) return 'Usuario o contraseña incorrectos.'
  if (/password should be at least/i.test(msg)) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (/LEGAJO_INVALIDO/.test(msg)) return 'El legajo debe tener el formato PE101L84 o PE101R12.'
  if (/same password|different from the old/i.test(msg)) return 'La nueva contraseña debe ser distinta de la anterior.'
  if (/Database error saving new user/i.test(msg)) {
    return 'No se pudo crear la cuenta. Revisa que el legajo no esté registrado y que los datos sean válidos.'
  }
  return msg || 'Ocurrió un error inesperado.'
}

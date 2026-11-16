// Wrapper de la Edge Function `admin-usuarios` (solo admin) + mensajes en español.
import { supabase } from './supabase'

const MENSAJES = {
  NO_AUTENTICADO: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  SIN_PERMISO: 'No tienes permiso para esta acción.',
  USUARIO_NO_ENCONTRADO: 'El usuario no existe.',
  NO_SOBRE_TU_CUENTA: 'No puedes hacer esta acción sobre tu propia cuenta.',
  ULTIMO_ADMIN: 'No se puede suspender ni eliminar al único administrador activo.',
  EMAIL_INVALIDO: 'El correo no es válido.',
  EMAIL_DUPLICADO: 'Ese correo ya pertenece a otro usuario.',
  SIN_EMAIL: 'El usuario no tiene correo registrado.',
  ESTADO_INVALIDO: 'Estado no válido.',
  CONFIRMACION_INVALIDA: 'La frase de confirmación no coincide.',
  ERROR_INTERNO: 'Error del servidor. Inténtalo de nuevo.',
}

async function invocar(accion, userId, params = {}) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    body: { accion, user_id: userId, ...params },
  })

  if (error) {
    let codigo = null
    try {
      codigo = (await error.context?.json?.())?.error
    } catch {
      // respuesta sin JSON: se usa el mensaje genérico
    }
    throw new Error(MENSAJES[codigo] || 'No se pudo completar la acción. ¿Está desplegada la función admin-usuarios?')
  }
  return data
}

export const cambiarEstadoUsuario = (userId, estado) =>
  invocar('cambiar_estado', userId, { estado })

// enviarCorreo=true manda el correo de recuperación; false devuelve { link }
export const reiniciarClaveUsuario = (userId, enviarCorreo) =>
  invocar('reiniciar_clave', userId, {
    enviar_correo: enviarCorreo,
    redirect_to: `${window.location.origin}/restablecer-clave`,
  })

// Elimina la cuenta y TODOS sus datos (irreversible). La frase se valida también en el servidor.
export const eliminarUsuario = (userId, confirmacion) =>
  invocar('eliminar_usuario', userId, { confirmacion })

export const cambiarEmailUsuario = (userId, email) =>
  invocar('cambiar_email', userId, { email })

// Edge Function: operaciones de administración de usuarios que necesitan la
// service role (nunca expuesta al navegador).
//
// Despliegue:  supabase functions deploy admin-usuarios
// Acciones (POST JSON { accion, ...params }):
//   cambiar_estado  { user_id, estado: 'activo' | 'suspendido' }
//   reiniciar_clave { user_id, redirect_to, enviar_correo }
//   cambiar_email   { user_id, email }
// Solo la puede llamar un admin con cuenta activa.

/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

class ErrorControlado extends Error {
  constructor(codigo, status = 400) {
    super(codigo)
    this.codigo = codigo
    this.status = status
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'METODO_NO_PERMITIDO' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // 1. Quién llama: JWT válido, rol admin y cuenta activa
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: errAuth } = await admin.auth.getUser(jwt)
    if (errAuth || !auth?.user) throw new ErrorControlado('NO_AUTENTICADO', 401)

    const { data: yo } = await admin
      .from('profiles').select('id, role, estado').eq('id', auth.user.id).maybeSingle()
    if (yo?.role !== 'admin' || yo?.estado !== 'activo') throw new ErrorControlado('SIN_PERMISO', 403)

    const { accion, user_id: userId, ...params } = await req.json()
    if (!userId) throw new ErrorControlado('USUARIO_REQUERIDO')

    const { data: objetivo } = await admin
      .from('profiles').select('id, email, role, estado').eq('id', userId).maybeSingle()
    if (!objetivo) throw new ErrorControlado('USUARIO_NO_ENCONTRADO', 404)

    if (userId === yo.id && accion !== 'cambiar_email') {
      throw new ErrorControlado('NO_SOBRE_TU_CUENTA')
    }

    // 2. Acciones
    if (accion === 'cambiar_estado') {
      const { estado } = params
      if (!['activo', 'suspendido'].includes(estado)) throw new ErrorControlado('ESTADO_INVALIDO')

      if (estado === 'suspendido' && objetivo.role === 'admin') {
        const { count } = await admin
          .from('profiles').select('id', { count: 'exact', head: true })
          .eq('role', 'admin').eq('estado', 'activo').neq('id', userId)
        if (!count) throw new ErrorControlado('ULTIMO_ADMIN')
      }

      const { error: errBan } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: estado === 'suspendido' ? '876000h' : 'none',
      })
      if (errBan) throw errBan

      const { error: errPerfil } = await admin.from('profiles').update({
        estado,
        suspendido_en: estado === 'suspendido' ? new Date().toISOString() : null,
      }).eq('id', userId)
      if (errPerfil) throw errPerfil

      if (estado === 'suspendido') await admin.rpc('admin_cerrar_sesiones', { p_user: userId })
      return responder({ ok: true, estado })
    }

    if (accion === 'reiniciar_clave') {
      const { redirect_to: redirectTo, enviar_correo: enviarCorreo } = params
      if (!objetivo.email) throw new ErrorControlado('SIN_EMAIL')

      // Invalida la clave actual y las sesiones abiertas
      const claveAleatoria = crypto.randomUUID() + crypto.randomUUID()
      const { error: errClave } = await admin.auth.admin.updateUserById(userId, { password: claveAleatoria })
      if (errClave) throw errClave
      await admin.rpc('admin_cerrar_sesiones', { p_user: userId })

      await admin.from('profiles')
        .update({ clave_reiniciada_en: new Date().toISOString() }).eq('id', userId)

      // Un usuario solo tiene un token de recuperación vigente: o se envía el
      // correo, o se devuelve el link para copiarlo (no ambos).
      if (enviarCorreo) {
        const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { error: errMail } = await anon.auth.resetPasswordForEmail(objetivo.email, { redirectTo })
        if (errMail) throw errMail
        return responder({ ok: true, enviado: true })
      }

      const { data: enlace, error: errLink } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: objetivo.email,
        options: { redirectTo },
      })
      if (errLink) throw errLink
      return responder({ ok: true, enviado: false, link: enlace.properties.action_link })
    }

    if (accion === 'cambiar_email') {
      const email = String(params.email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorControlado('EMAIL_INVALIDO')

      const { error: errEmail } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      })
      if (errEmail) throw errEmail
      const { error: errPerfil } = await admin.from('profiles').update({ email }).eq('id', userId)
      if (errPerfil) throw errPerfil
      return responder({ ok: true })
    }

    throw new ErrorControlado('ACCION_DESCONOCIDA')
  } catch (e) {
    if (e instanceof ErrorControlado) return responder({ error: e.codigo }, e.status)
    const msg = String(e?.message || e)
    if (/already|registered|duplicate/i.test(msg)) return responder({ error: 'EMAIL_DUPLICADO' }, 409)
    console.error('admin-usuarios:', msg)
    return responder({ error: 'ERROR_INTERNO', detalle: msg }, 500)
  }
})

import { supabase } from './supabase'
import { db } from './db'

function normalizarTarea(tarea) {
  return {
    ...tarea,
    ce: String(tarea?.ce ?? tarea?.CE ?? '').trim(),
  }
}

function normalizarMisTarea(tarea) {
  return {
    ...tarea,
    wo: String(tarea?.wo ?? tarea?.tarea_wo ?? '').trim(),
    ce: String(tarea?.ce ?? tarea?.CE ?? '').trim(),
    estado: tarea?.estado || 'pendiente',
    completadaEn: tarea?.completadaEn ?? tarea?.completada_en ?? tarea?.completada_at ?? null,
  }
}

export async function syncFromSupabase(userId) {
  try {
    const consultas = [
      supabase.from('tareas').select('*'),
      supabase.from('personal_cmca').select('*'),
      supabase.from('personal_cmpd').select('*'),
      supabase.from('motivos_aqr').select('*'),
    ]

    if (userId) {
      consultas.push(
        supabase
          .from('mis_tareas')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      )
    }

    const [tareas, cmca, cmpd, motivos, misTareas] = await Promise.all(consultas)

    if (tareas.data)   await db.tareas.clear().then(() => db.tareas.bulkAdd(tareas.data.map(normalizarTarea)))
    if (cmca.data)     await db.personal_cmca.clear().then(() => db.personal_cmca.bulkAdd(cmca.data))
    if (cmpd.data)     await db.personal_cmpd.clear().then(() => db.personal_cmpd.bulkAdd(cmpd.data))
    if (motivos.data)  await db.motivos_aqr.clear().then(() => db.motivos_aqr.bulkAdd(motivos.data))
    if (misTareas?.data) {
      const tareasPorWo = new Map((tareas.data || []).map(tarea => [String(tarea.wo).trim(), normalizarTarea(tarea)]))
      const misTareasNormalizadas = misTareas.data.map(item => {
        const wo = String(item.tarea_wo || '').trim()
        const tareaBase = tareasPorWo.get(wo) || {}

        return normalizarMisTarea({
          ...tareaBase,
          remoteId: item.id,
          user_id: item.user_id,
          wo,
          estado: item.estado,
          completadaAt: item.completada_at,
          completadaEn: item.completada_at,
          createdAt: item.created_at,
        })
      })

      await db.mis_tareas.clear()
      if (misTareasNormalizadas.length) {
        await db.mis_tareas.bulkAdd(misTareasNormalizadas)
      }
    }

    console.log('✅ Sync completado')
  } catch (err) {
    console.warn('⚠️ Sin conexión, usando caché local', err)
  }
}

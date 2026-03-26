import { supabase } from './supabase'
import { db } from './db'

function normalizarTarea(tarea) {
  return {
    ...tarea,
    ce: String(tarea?.ce ?? tarea?.CE ?? '').trim(),
  }
}

export async function syncFromSupabase() {
  try {
    const [tareas, cmca, cmpd, motivos] = await Promise.all([
      supabase.from('tareas').select('*'),
      supabase.from('personal_cmca').select('*'),
      supabase.from('personal_cmpd').select('*'),
      supabase.from('motivos_aqr').select('*'),
    ])

    if (tareas.data)   await db.tareas.clear().then(() => db.tareas.bulkAdd(tareas.data.map(normalizarTarea)))
    if (cmca.data)     await db.personal_cmca.clear().then(() => db.personal_cmca.bulkAdd(cmca.data))
    if (cmpd.data)     await db.personal_cmpd.clear().then(() => db.personal_cmpd.bulkAdd(cmpd.data))
    if (motivos.data)  await db.motivos_aqr.clear().then(() => db.motivos_aqr.bulkAdd(motivos.data))

    console.log('✅ Sync completado')
  } catch (err) {
    console.warn('⚠️ Sin conexión, usando caché local', err)
  }
}

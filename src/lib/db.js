import Dexie from 'dexie'

export const db = new Dexie('ATMManager')

db.version(1).stores({
  tareas:        '++localId, wo, id_atm, fecha',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
})

db.version(2).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('tareas').toCollection().modify(tarea => {
    if (!tarea.ce && tarea.CE) {
      tarea.ce = String(tarea.CE).trim()
    }
  })
})

db.version(3).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
})

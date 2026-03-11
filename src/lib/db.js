import Dexie from 'dexie'

export const db = new Dexie('ATMManager')

db.version(1).stores({
  tareas:        '++localId, wo, id_atm, fecha',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
})
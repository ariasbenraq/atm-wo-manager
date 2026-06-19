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

db.version(4).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('mis_tareas').toCollection().modify(tarea => {
    tarea.estado = tarea.estado || 'pendiente'
    tarea.completadaEn = tarea.completadaEn || null
  })
})

db.version(5).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  repuestos:     '++localId, nombre, partNumber, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
})

db.version(6).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  repuestos:     '++localId, nombre, partNumber, descripcion, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('repuestos').toCollection().modify(repuesto => {
    repuesto.descripcion = repuesto.descripcion || ''
  })
})

db.version(7).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  repuestos:     '++localId, nombre, partNumber, descripcion, tieneStock, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('repuestos').toCollection().modify(repuesto => {
    repuesto.tieneStock = Boolean(repuesto.tieneStock)
  })
})

db.version(8).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  repuestos:     '++localId, nombre, partNumber, descripcion, tieneStock, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
})

db.version(9).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn',
  repuestos:     '++localId, nombre, partNumber, descripcion, tieneStock, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('repuestos').toCollection().modify(repuesto => {
    delete repuesto.imagenUrl
  })
})

db.version(10).stores({
  tareas:        '++localId, wo, id_atm, fecha, ce',
  mis_tareas:    '++localId, &wo, id_atm, fecha, ce, estado, completadaEn, ds, arribo, inicio, fin, retorno, tiemposUpdatedAt, tiemposSyncPendiente',
  repuestos:     '++localId, nombre, partNumber, descripcion, tieneStock, creadoEn',
  personal_cmca: '++localId, nombre',
  personal_cmpd: '++localId, nombre',
  motivos_aqr:   '++localId, descripcion',
  cierres:       '++localId, wo',
}).upgrade(async tx => {
  await tx.table('mis_tareas').toCollection().modify(tarea => {
    tarea.ds = tarea.ds || null
    tarea.arribo = tarea.arribo || null
    tarea.inicio = tarea.inicio || null
    tarea.fin = tarea.fin || null
    tarea.retorno = tarea.retorno || null
    tarea.tiemposUpdatedAt = tarea.tiemposUpdatedAt || null
    tarea.tiemposSyncPendiente = Boolean(tarea.tiemposSyncPendiente)
  })
})

db.version(11).stores({
  tareas:         '++localId, wo, id_atm, fecha, ce',
  mis_tareas:     '++localId, &wo, id_atm, fecha, ce, estado, completadaEn, ds, arribo, inicio, fin, retorno, tiemposUpdatedAt, tiemposSyncPendiente',
  repuestos:      '++localId, nombre, partNumber, descripcion, tieneStock, compatibilidad, creadoEn',
  userSpareParts: '++localId, userId, sparePartId',
  personal_cmca:  '++localId, nombre',
  personal_cmpd:  '++localId, nombre',
  motivos_aqr:    '++localId, descripcion',
  cierres:        '++localId, wo',
}).upgrade(async tx => {
  await tx.table('repuestos').toCollection().modify(repuesto => {
    repuesto.compatibilidad = repuesto.compatibilidad || ''
  })
})

db.version(12).stores({
  tareas:            '++localId, wo, id_atm, fecha, ce',
  mis_tareas:        '++localId, &wo, id_atm, fecha, ce, estado, completadaEn, ds, arribo, inicio, fin, retorno, tiemposUpdatedAt, tiemposSyncPendiente',
  repuestos:         '++localId, nombre, partNumber, descripcion, tieneStock, compatibilidad, creadoEn',
  sparePartLists:    '++localId, userId, name',
  sparePartListItems: '++localId, listId, sparePartId',
  personal_cmca:     '++localId, nombre',
  personal_cmpd:     '++localId, nombre',
  motivos_aqr:       '++localId, descripcion',
  cierres:           '++localId, wo',
})

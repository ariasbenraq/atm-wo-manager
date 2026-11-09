import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { excelFechaAString, excelHoraAString, mesAISO } from '../lib/excel'
import { LEGAJO_ACTUAL } from '../lib/wosConfig'
import { mapearFila, resolverSite, fusionarVacios, texto } from '../lib/wosImport'
import WosSkeleton from './WosSkeleton'
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Chip, Alert as HeroAlert,
} from '@heroui/react'
import { Upload, FileSpreadsheet, Check, X } from 'lucide-react'

function normalizarLegajo(valor) {
  return texto(valor).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export default function ImportarWosExcel({ isOpen, onClose, userId, onImportado }) {
  const [cargando, setCargando] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [hojas, setHojas] = useState([])
  const [hojasSeleccionadas, setHojasSeleccionadas] = useState([])
  const [dragging, setDragging] = useState(false)
  const [estado, setEstado] = useState(null)
  const [mensaje, setMensaje] = useState('')

  function reiniciar() {
    setArchivo(null)
    setHojas([])
    setHojasSeleccionadas([])
    setEstado(null)
    setMensaje('')
    setDragging(false)
  }

  function cerrar() {
    if (cargando && estado === 'loading') return
    reiniciar()
    onClose && onClose()
  }

  function alternarHoja(nombre) {
    setHojasSeleccionadas(prev =>
      prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]
    )
  }

  async function leerArchivo(arch) {
    if (!arch) return
    setCargando(true)
    setEstado(null)
    setMensaje('')
    try {
      const buffer = await arch.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const nombres = workbook.SheetNames || []

      if (!nombres.length) {
        setEstado('error')
        setMensaje('El archivo no tiene pestañas.')
        setCargando(false)
        return
      }

      setArchivo({ archivo: arch, workbook })
      setHojas(nombres)
      setHojasSeleccionadas([...nombres])
    } catch (err) {
      setEstado('error')
      setMensaje(err.message || 'No se pudo leer el archivo.')
    }
    setCargando(false)
  }

  async function importar() {
    if (!archivo || !hojasSeleccionadas.length || !userId) return
    setCargando(true)
    setEstado('loading')
    setMensaje('Procesando pestañas...')

    try {
      let leidas = 0
      let sinWo = 0
      let otrasLegajos = 0
      let duplicadasArchivo = 0
      const vistas = new Map()
      const legajosVistos = new Map()
      const objetivo = normalizarLegajo(LEGAJO_ACTUAL)

      for (const nombreHoja of hojasSeleccionadas) {
        const hoja = archivo.workbook.Sheets[nombreHoja]
        if (!hoja) continue
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', blankrows: false })
        for (const fila of filas) {
          leidas++
          const cruda = mapearFila(fila)
          const wo = texto(cruda.wo)
          if (!wo) {
            sinWo++
            continue
          }

          const legajoCrudo = texto(cruda.legajo)
          const legajo = normalizarLegajo(legajoCrudo)
          const claveLegajo = legajoCrudo || '(sin columna legajo)'
          legajosVistos.set(claveLegajo, (legajosVistos.get(claveLegajo) || 0) + 1)

          if (legajo !== objetivo) {
            otrasLegajos++
            continue
          }

          const fecha = excelFechaAString(cruda.fecha) || texto(cruda.fecha)
          const clave = `${wo}|${fecha}`
          const registro = {
            user_id: userId,
            anio: texto(cruda.anio),
            mes: mesAISO(cruda.mes),
            cliente: texto(cruda.cliente),
            serie: texto(cruda.serie),
            modelo: texto(cruda.modelo),
            tipo_pm: texto(cruda.tipo_pm),
            codigo_equipo: texto(cruda.codigo_equipo),
            nombre_equipo: texto(cruda.nombre_equipo),
            site: resolverSite(cruda),
            direccion: texto(cruda.direccion),
            distrito: texto(cruda.distrito),
            provincia: texto(cruda.provincia),
            departamento: texto(cruda.departamento),
            lp: texto(cruda.lp),
            funcion_atm: texto(cruda.funcion_atm),
            horario_pv: texto(cruda.horario_pv),
            restricciones: texto(cruda.restricciones),
            responsable_boveda: texto(cruda.responsable_boveda),
            wo,
            fecha,
            hora: excelHoraAString(cruda.hora) || texto(cruda.hora),
            hora_pv: excelHoraAString(cruda.hora_pv) || texto(cruda.hora_pv),
            legajo,
            ce: texto(cruda.ce),
            dni: texto(cruda.dni),
            updated_at: new Date().toISOString(),
          }

          if (vistas.has(clave)) {
            duplicadasArchivo++
            vistas.set(clave, fusionarVacios(vistas.get(clave), registro))
          } else {
            vistas.set(clave, registro)
          }
        }
      }

      let registros = Array.from(vistas.values())

      if (!registros.length) {
        const topLegajos = Array.from(legajosVistos.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([leg, n]) => `${leg} (${n})`)
          .join(', ')
        setEstado('warning')
        setMensaje(
          `No se encontraron filas para importar (legajo ${LEGAJO_ACTUAL}). ` +
          `Leídas: ${leidas}, sin WO: ${sinWo}, otras legajos: ${otrasLegajos}. ` +
          `Legajos encontrados en el archivo: ${topLegajos || 'ninguno'}.`
        )
        setCargando(false)
        return
      }

      setMensaje('Comparando con workorders existentes...')

      // Evita pisar valores válidos ya guardados con celdas vacías de otro archivo.
      const existentes = new Map()
      const wosUnicas = [...new Set(registros.map(r => r.wo))]
      for (let i = 0; i < wosUnicas.length; i += 200) {
        const { data: previas, error: errPrevias } = await supabase
          .from('workorders')
          .select('*')
          .eq('user_id', userId)
          .in('wo', wosUnicas.slice(i, i + 200))
        if (errPrevias) throw errPrevias
        for (const previa of previas || []) existentes.set(`${previa.wo}|${previa.fecha}`, previa)
      }

      let actualizadas = 0
      registros = registros.map(r => {
        const previa = existentes.get(`${r.wo}|${r.fecha}`)
        if (!previa) return r
        actualizadas++
        return fusionarVacios(r, previa)
      })
      const nuevas = registros.length - actualizadas

      setMensaje(`Guardando ${registros.length} workorders...`)

      const { data, error } = await supabase
        .from('workorders')
        .upsert(registros, { onConflict: 'user_id,wo,fecha' })
        .select('*')

      if (error) throw error

      for (const row of data || []) {
        const local = {
          idRemoto: row.id,
          userId: row.user_id,
          anio: row.anio || '',
          mes: row.mes || '',
          cliente: row.cliente || '',
          serie: row.serie || '',
          modelo: row.modelo || '',
          tipoPm: row.tipo_pm || '',
          codigoEquipo: row.codigo_equipo || '',
          nombreEquipo: row.nombre_equipo || '',
          site: row.site || '',
          direccion: row.direccion || '',
          distrito: row.distrito || '',
          provincia: row.provincia || '',
          departamento: row.departamento || '',
          lp: row.lp || '',
          funcionAtm: row.funcion_atm || '',
          horarioPv: row.horario_pv || '',
          restricciones: row.restricciones || '',
          responsableBoveda: row.responsable_boveda || '',
          wo: row.wo || '',
          fecha: row.fecha || '',
          hora: row.hora || '',
          horaPv: row.hora_pv || '',
          legajo: row.legajo || '',
          ce: row.ce || '',
          dni: row.dni || '',
          creadoEn: row.created_at,
          actualizadoEn: row.updated_at,
        }
        const existe = await db.workorders.filter(w => w.idRemoto === row.id).count()
        if (existe) {
          await db.workorders.filter(w => w.idRemoto === row.id).modify(local)
        } else {
          await db.workorders.add(local)
        }
      }

      setEstado('ok')
      setMensaje(
        `${nuevas} nuevas, ${actualizadas} actualizadas. ` +
        `Omitidas: ${otrasLegajos} de otros legajos, ${sinWo} sin WO, ` +
        `${duplicadasArchivo} duplicadas en archivo (fusionadas). Leídas: ${leidas}.`
      )
      setArchivo(null)
      setHojas([])
      setHojasSeleccionadas([])
      onImportado && onImportado()
    } catch (err) {
      setEstado('error')
      setMensaje(err.message || 'No se pudo importar el archivo.')
    }
    setCargando(false)
  }

  const alertConfig = {
    ok: { color: 'success', title: 'Importación completada' },
    error: { color: 'danger', title: 'No se pudo importar el Excel' },
    warning: { color: 'warning', title: 'Sin filas para importar' },
    loading: { color: 'primary', title: 'Procesando archivo' },
  }

  const importando = estado === 'loading'
  const terminado = estado === 'ok'

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={open => { if (!open) cerrar() }}
      isDismissable={!importando}
      hideCloseButton={importando}
      placement="center"
      size="md"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-default-400" />
          Importar Wo&apos;s desde Excel
        </ModalHeader>
        <ModalBody className="gap-3">
          {importando ? (
            <>
              <p className="text-sm text-default-500">{mensaje}</p>
              <WosSkeleton filas={3} />
            </>
          ) : (
            <>
              {!terminado && (
                <label
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); leerArchivo(e.dataTransfer.files[0]) }}
                  className={`flex flex-col items-center justify-center gap-3 border-2
                    border-dashed rounded-xl p-6 cursor-pointer transition-all
                    ${dragging ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-primary-300'}`}
                >
                  <Upload size={24} className={dragging ? 'text-primary' : 'text-default-300'} />
                  <div className="text-center">
                    <p className="text-sm font-medium text-default-600">
                      {cargando && !archivo ? 'Leyendo archivo...' : archivo ? archivo.archivo.name : 'Elegir archivo Excel'}
                    </p>
                    <p className="text-xs text-default-400 mt-0.5">
                      .xlsx · pestañas por rango de fechas · solo legajo {LEGAJO_ACTUAL}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => leerArchivo(e.target.files[0])}
                    disabled={cargando}
                    className="hidden"
                  />
                </label>
              )}

              {cargando && !archivo && <WosSkeleton filas={1} />}

              {hojas.length > 0 && (
                <div className="rounded-lg border border-default-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                      Pestañas ({hojasSeleccionadas.length}/{hojas.length})
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="light" onPress={() => setHojasSeleccionadas([...hojas])}>
                        Todas
                      </Button>
                      <Button size="sm" variant="light" onPress={() => setHojasSeleccionadas([])}>
                        Ninguna
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hojas.map(nombre => {
                      const activa = hojasSeleccionadas.includes(nombre)
                      return (
                        <Chip
                          key={nombre}
                          size="sm"
                          variant={activa ? 'flat' : 'bordered'}
                          color={activa ? 'primary' : 'default'}
                          startContent={activa ? <Check size={12} /> : undefined}
                          className="cursor-pointer"
                          onClick={() => alternarHoja(nombre)}
                        >
                          {nombre}
                        </Chip>
                      )
                    })}
                  </div>
                </div>
              )}

              {mensaje && (
                <HeroAlert
                  color={alertConfig[estado]?.color || 'primary'}
                  title={alertConfig[estado]?.title || 'Estado de importación'}
                  description={mensaje}
                />
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={cerrar} isDisabled={importando} startContent={<X size={16} />}>
            {terminado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!terminado && (
            <Button
              color="primary"
              onPress={importar}
              isLoading={importando}
              isDisabled={!archivo || !hojasSeleccionadas.length || cargando}
              startContent={!importando ? <Check size={16} /> : undefined}
            >
              Importar
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

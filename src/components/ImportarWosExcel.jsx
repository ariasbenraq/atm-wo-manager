import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { excelFechaAString, excelHoraAString, normalizarEncabezado } from '../lib/excel'
import { LEGAJO_ACTUAL } from '../lib/wosConfig'
import {
  Card, CardBody, CardHeader, Divider,
  Button, Chip, Alert as HeroAlert, Spinner,
} from '@heroui/react'
import { Upload, FileSpreadsheet, Check } from 'lucide-react'

const MAPEO_COLUMNAS = {
  'ano': 'anio',
  'mes': 'mes',
  'cliente': 'cliente',
  'n de serie': 'serie',
  'numero de serie': 'serie',
  'modelo': 'modelo',
  'tipo pm': 'tipo_pm',
  'codigo del equipo': 'codigo_equipo',
  'nombre del equipo': 'nombre_equipo',
  'site': 'site',
  'direccion': 'direccion',
  'distrito': 'distrito',
  'provincia': 'provincia',
  'departamento': 'departamento',
  'l/p': 'lp',
  'funcion atm': 'funcion_atm',
  'horario con pv': 'horario_pv',
  'restricciones / documentacion': 'restricciones',
  'restricciones documentacion': 'restricciones',
  'responsable boveda etv/oficina': 'responsable_boveda',
  'responsable boveda etv oficina': 'responsable_boveda',
  'wo': 'wo',
  'fecha': 'fecha',
  'hora': 'hora',
  'hora pv': 'hora_pv',
  'legajo': 'legajo',
  'ce': 'ce',
  'dni': 'dni',
}

function mapearFila(fila) {
  const resultado = {}
  for (const [clave, valor] of Object.entries(fila)) {
    const campo = MAPEO_COLUMNAS[normalizarEncabezado(clave)]
    if (campo) resultado[campo] = valor
  }
  return resultado
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function normalizarLegajo(valor) {
  return texto(valor).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export default function ImportarWosExcel({ userId, onImportado }) {
  const [cargando, setCargando] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [hojas, setHojas] = useState([])
  const [hojasSeleccionadas, setHojasSeleccionadas] = useState([])
  const [dragging, setDragging] = useState(false)
  const [estado, setEstado] = useState(null)
  const [mensaje, setMensaje] = useState('')

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
          if (vistas.has(clave)) {
            duplicadasArchivo++
            continue
          }

          vistas.set(clave, {
            user_id: userId,
            anio: texto(cruda.anio),
            mes: texto(cruda.mes),
            cliente: texto(cruda.cliente),
            serie: texto(cruda.serie),
            modelo: texto(cruda.modelo),
            tipo_pm: texto(cruda.tipo_pm),
            codigo_equipo: texto(cruda.codigo_equipo),
            nombre_equipo: texto(cruda.nombre_equipo),
            site: texto(cruda.site),
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
          })
        }
      }

      const registros = Array.from(vistas.values())

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
        `${(data || []).length} workorders importadas. ` +
        `(Leídas: ${leidas}, duplicadas en archivo: ${duplicadasArchivo}, ` +
        `otras legajos: ${otrasLegajos}, sin WO: ${sinWo})`
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

  return (
    <Card shadow="sm">
      <CardHeader className="flex gap-3 pb-0">
        <FileSpreadsheet size={18} className="text-default-400" />
        <p className="text-sm font-semibold">Importar Wo&apos;s desde Excel</p>
      </CardHeader>
      <Divider className="mt-3" />
      <CardBody className="gap-3">
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
              {cargando && !archivo ? 'Procesando...' : archivo ? archivo.archivo.name : 'Sube tu archivo Excel'}
            </p>
            <p className="text-xs text-default-400 mt-0.5">
              .xlsx · con pestañas por rango de fechas · solo legajo {LEGAJO_ACTUAL}
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

        {hojas.length > 0 && (
          <div className="rounded-lg border border-default-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                Pestañas ({hojasSeleccionadas.length}/{hojas.length} seleccionadas)
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
                    onPress={() => alternarHoja(nombre)}
                  >
                    {nombre}
                  </Chip>
                )
              })}
            </div>
            <Button
              size="sm"
              color="primary"
              onPress={importar}
              isLoading={cargando}
              isDisabled={!hojasSeleccionadas.length}
              startContent={!cargando ? <Check size={16} /> : undefined}
              className="mt-1"
            >
              Importar pestañas seleccionadas
            </Button>
          </div>
        )}

        {mensaje && (
          <HeroAlert
            color={alertConfig[estado]?.color || 'primary'}
            title={alertConfig[estado]?.title || 'Estado de importación'}
            description={mensaje}
            startContent={estado === 'loading' ? <Spinner size="sm" /> : undefined}
            onClose={() => { setEstado(null); setMensaje('') }}
          />
        )}
      </CardBody>
    </Card>
  )
}

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { Card, CardBody, CardHeader, Button, Chip, Divider } from '@heroui/react'
import { Upload, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react'

function excelFechaAString(valor) {
  if (!valor) return null
  if (typeof valor === 'string') {
    const fechaTexto = valor.trim()
    if (!fechaTexto) return null

    const matchLatam = fechaTexto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
    if (matchLatam) {
      const dia = Number(matchLatam[1])
      const mes = Number(matchLatam[2])
      const anio = Number(matchLatam[3].length === 2 ? `20${matchLatam[3]}` : matchLatam[3])
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio >= 1900) {
        return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      }
    }

    const fechaNativa = new Date(fechaTexto)
    if (!Number.isNaN(fechaNativa.getTime())) {
      return fechaNativa.toISOString().split('T')[0]
    }

    return null
  }
  if (typeof valor === 'number') {
    const parsed = XLSX.SSF.parse_date_code(valor)
    if (!parsed) return null
    return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return null
}

function excelHoraAString(valor) {
  if (!valor) return ''
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number') {
    const totalMinutos = Math.round(valor * 24 * 60)
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
  }
  return String(valor)
}

export default function ImportarExcel({ onImportado }) {
  const [cargando, setCargando] = useState(false)
  const [estado, setEstado] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [dragging, setDragging] = useState(false)

  async function procesarArchivo(archivo) {
    if (!archivo) return
    setCargando(true)
    setEstado(null)
    setMensaje('Leyendo Excel...')

    try {
      const buffer = await archivo.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const hoja = workbook.Sheets[workbook.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', blankrows: false })

      if (filas.length === 0) {
        setEstado('error'); setMensaje('El archivo no tiene datos.')
        setCargando(false); return
      }

      const tareasCrudas = filas.map(fila => ({
        wo:        String(fila['WO']        || '').trim(),
        modelo:    String(fila['MODELO']    || '').trim(),
        serie:     String(fila['SERIE']     || '').trim(),
        id_atm:    String(fila['ID']        || '').trim(),
        nombre:    String(fila['NOMBRE']    || '').trim(),
        direccion: String(fila['DIRECCION'] || '').trim(),
        distrito:  String(fila['DISTRITO']  || '').trim(),
        fecha:     excelFechaAString(fila['FECHA']),
        hora:      excelHoraAString(fila['HORA']),
        ce:        String(fila['CE']        || '').trim(),
      })).filter(t => t.wo !== '')

      const tareasPorWo = new Map()
      for (const tarea of tareasCrudas) {
        tareasPorWo.set(tarea.wo, tarea)
      }
      const tareas = Array.from(tareasPorWo.values())
      const duplicados = tareasCrudas.length - tareas.length
      if (tareas.length === 0) {
        setEstado('error')
        setMensaje('No se encontraron filas con WO válido para importar.')
        setCargando(false)
        return
      }

      setMensaje(`Subiendo ${tareas.length} tareas...`)
      const { error } = await supabase.from('tareas').upsert(tareas, { onConflict: 'wo' })
      if (error) throw error

      await db.tareas.clear()
      await db.tareas.bulkAdd(tareas)

      setEstado('ok')
      setMensaje(
        duplicados > 0
          ? `${tareas.length} tareas importadas (${duplicados} filas duplicadas por WO fueron reemplazadas por la última ocurrencia).`
          : `${tareas.length} tareas importadas`
      )
      onImportado && onImportado(tareas)
    } catch (err) {
      setEstado('error')
      setMensaje(err.message)
    }
    setCargando(false)
  }

  return (
    <Card shadow="sm">
      <CardHeader className="flex gap-3 pb-0">
        <FileSpreadsheet size={18} className="text-default-400" />
        <p className="text-sm font-semibold">Importar Excel</p>
      </CardHeader>
      <Divider className="mt-3" />
      <CardBody>
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); procesarArchivo(e.dataTransfer.files[0]) }}
          className={`flex flex-col items-center justify-center gap-3 border-2
            border-dashed rounded-xl p-6 cursor-pointer transition-all
            ${dragging ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-primary-300'}`}
        >
          <Upload size={24} className={dragging ? 'text-primary' : 'text-default-300'} />
          <div className="text-center">
            <p className="text-sm font-medium text-default-600">
              {cargando ? 'Procesando...' : 'Sube tu archivo Excel'}
            </p>
            <p className="text-xs text-default-400 mt-0.5">.xlsx · arrastra o toca para seleccionar</p>
          </div>
          <input type="file" accept=".xlsx,.xls" onChange={e => procesarArchivo(e.target.files[0])}
            disabled={cargando} className="hidden" />
        </label>

        {mensaje && (
          <Chip
            className="mt-3 w-full max-w-full h-auto py-2"
            variant="flat"
            color={estado === 'ok' ? 'success' : estado === 'error' ? 'danger' : 'primary'}
            startContent={
              estado === 'ok' ? <CheckCircle size={14} /> :
              estado === 'error' ? <XCircle size={14} /> : null
            }
          >
            {mensaje}
          </Chip>
        )}
      </CardBody>
    </Card>
  )
}

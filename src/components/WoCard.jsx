import { useState, useRef, useEffect } from 'react'
import { Card } from 'konsta/react'
import { Copy, Check } from 'lucide-react'
import { formatearFecha } from '../lib/date'

const CLASES_ESTADO = {
  hoy: 'bg-amber-100 text-amber-800',
  pasado: 'bg-gray-200 text-gray-600',
  futuro: 'bg-green-100 text-green-800',
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Fallback para contextos sin Clipboard API (http, webviews antiguos)
    try {
      const area = document.createElement('textarea')
      area.value = texto
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

// Color del ID según el banco (campo `cliente`, comparado sin tildes ni mayúsculas)
const COLORES_BANCO = [
  { patron: /credito|bcp/, clases: 'bg-blue-700 text-white' },
  { patron: /interbank|ibk/, clases: 'bg-green-600 text-white' },
  { patron: /bbva|continental/, clases: 'bg-sky-500 text-white' },
  { patron: /nacion|bn\b/, clases: 'bg-red-600 text-white' },
]

function clasesBanco(cliente) {
  const texto = String(cliente || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return COLORES_BANCO.find(c => c.patron.test(texto))?.clases || null
}

const CHIP_FECHA_HORA = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium'

function CampoCopiable({ etiqueta, valor, destacado = false, clasesValor = null }) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copiar(e) {
    e.stopPropagation()
    if (!valor) return
    if (await copiarTexto(String(valor))) {
      setCopiado(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiado(false), 1500)
    }
  }

  const tamano = destacado ? 'text-base font-semibold' : 'text-sm'

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-0.5">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">{etiqueta}</p>
        {valor && (
          <button
            type="button"
            onClick={copiar}
            aria-label={copiado ? `${etiqueta} copiado` : `Copiar ${etiqueta}`}
            className="cursor-pointer rounded-full p-1 text-gray-400 hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10"
          >
            {copiado ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          </button>
        )}
      </div>
      {clasesValor && valor ? (
        <span className={`inline-block max-w-full truncate rounded-md px-2 py-0.5 ${tamano} ${clasesValor}`}>
          {valor}
        </span>
      ) : (
        <p className={`truncate ${tamano}`}>{valor || '—'}</p>
      )}
    </div>
  )
}

export default function WoCard({ wo, estadoFecha, onClick }) {
  const site = wo.site || wo.nombre_equipo

  return (
    <Card
      className="!mx-0 !my-2 cursor-pointer"
      contentWrapPadding="p-3"
      onClick={onClick}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <CampoCopiable etiqueta="WO" valor={wo.wo} destacado />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {wo.fecha && (
            <span className={`${CHIP_FECHA_HORA} ${CLASES_ESTADO[estadoFecha] || 'bg-gray-100 text-gray-700'}`}>
              {formatearFecha(wo.fecha)}
            </span>
          )}
          {wo.hora && (
            <span className={`${CHIP_FECHA_HORA} ${CLASES_ESTADO[estadoFecha] || 'bg-gray-100 text-gray-700'}`}>
              {wo.hora}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <CampoCopiable etiqueta="ID" valor={wo.codigo_equipo} clasesValor={clasesBanco(wo.cliente)} />
        <CampoCopiable etiqueta="Site" valor={site} />
        <div className="grid grid-cols-2 gap-2">
          <CampoCopiable etiqueta="Modelo" valor={wo.modelo} />
          <CampoCopiable etiqueta="Serie" valor={wo.serie} />
        </div>
      </div>
    </Card>
  )
}

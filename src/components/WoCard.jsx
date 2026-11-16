import { useState, useRef, useEffect } from 'react'
import SectionCard from './ui/SectionCard'
import { Copy, Check, User, ChevronRight } from 'lucide-react'
import { formatearFecha } from '../lib/date'

const CLASES_ESTADO = {
  hoy: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  pasado: 'bg-default-200 text-default-600',
  futuro: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
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
  { patron: /interbank|ibk/, clases: 'bg-green-700 text-white' },
  { patron: /bbva|continental/, clases: 'bg-sky-700 text-white' },
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
        <p className="text-[10px] uppercase tracking-wide text-default-400">{etiqueta}</p>
        {valor && (
          <button
            type="button"
            onClick={copiar}
            aria-label={copiado ? `${etiqueta} copiado` : `Copiar ${etiqueta}`}
            className="cursor-pointer rounded-full p-1 text-default-400 hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10"
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

export default function WoCard({ wo, estadoFecha, tecnico = '', onClick }) {
  const site = wo.site || wo.nombre_equipo

  return (
    <SectionCard
      padding="sm"
      className="my-2 cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <CampoCopiable etiqueta="WO" valor={wo.wo} destacado />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {wo.fecha && (
            <span className={`${CHIP_FECHA_HORA} ${CLASES_ESTADO[estadoFecha] || 'bg-default-100 text-default-700'}`}>
              {formatearFecha(wo.fecha)}
            </span>
          )}
          {wo.hora && (
            <span className={`${CHIP_FECHA_HORA} ${CLASES_ESTADO[estadoFecha] || 'bg-default-100 text-default-700'}`}>
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
        {(tecnico || wo.legajo) && (
          <div className="mt-0.5 flex items-center gap-1.5 border-t border-default-100 pt-1.5 text-xs text-default-500">
            <User size={12} className="shrink-0 text-default-400" aria-hidden="true" />
            <span className="min-w-0 truncate font-medium text-default-700 dark:text-gray-300">
              {tecnico || 'Sin nombre'}
            </span>
            {wo.legajo && (
              <span className="shrink-0 rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-600 dark:bg-white/10 dark:text-gray-300">
                {wo.legajo}
              </span>
            )}
          <button
              type="button"
              onClick={e => { e.stopPropagation(); onClick?.() }}
              className="ml-auto flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary-50"
              aria-label={`Ver detalle de la WO ${wo.wo}`}
            >
              Detalle <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

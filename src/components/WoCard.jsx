import { useState, useRef, useEffect } from 'react'
import { Card, Chip } from 'konsta/react'
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

function CampoCopiable({ etiqueta, valor, destacado = false }) {
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

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className={`truncate ${destacado ? 'text-base font-semibold' : 'text-sm'}`}>
          {valor || '—'}
        </p>
      </div>
      {valor && (
        <button
          type="button"
          onClick={copiar}
          aria-label={copiado ? `${etiqueta} copiado` : `Copiar ${etiqueta}`}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10"
        >
          {copiado ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>
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
            <Chip className={`px-2 ${CLASES_ESTADO[estadoFecha] || ''}`}>
              {formatearFecha(wo.fecha)}
            </Chip>
          )}
          {wo.hora && <span className="text-xs font-medium">{wo.hora}</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <CampoCopiable etiqueta="ID" valor={wo.codigo_equipo} />
        <CampoCopiable etiqueta="Site" valor={site} />
        <div className="grid grid-cols-2 gap-2">
          <CampoCopiable etiqueta="Modelo" valor={wo.modelo} />
          <CampoCopiable etiqueta="Serie" valor={wo.serie} />
        </div>
      </div>
    </Card>
  )
}

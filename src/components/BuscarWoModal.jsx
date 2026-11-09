import { useState, useEffect, useRef } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, Input, Spinner } from '@heroui/react'
import { Search, X, Clock } from 'lucide-react'
import { db } from '../lib/db'
import { formatearFecha } from '../lib/date'

const DEBOUNCE_MS = 300
const MAX_RESULTADOS = 30
const MAX_RECIENTES = 8
const CLAVE_RECIENTES = 'wos_busqueda_recientes'

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function leerRecientes() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]')
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function guardarReciente(item) {
  try {
    const resto = leerRecientes().filter(r => r.id !== item.id)
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([item, ...resto].slice(0, MAX_RECIENTES)))
  } catch { /* sin almacenamiento disponible */ }
}

// Busca en la caché local (Dexie) por WO, ID, site y legajo
async function buscarLocal(texto) {
  const tokens = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const todas = await db.workorders.toArray()
  const resultado = []
  for (const w of todas) {
    const site = w.site || w.nombreEquipo || ''
    const campos = [w.wo, w.codigoEquipo, site, w.legajo, w.distrito].map(normalizar)
    if (tokens.every(t => campos.some(c => c.includes(t)))) {
      resultado.push({
        id: w.idRemoto,
        wo: w.wo,
        fecha: w.fecha,
        codigo_equipo: w.codigoEquipo,
        site,
        legajo: w.legajo,
        distrito: w.distrito,
      })
      if (resultado.length >= MAX_RESULTADOS) break
    }
  }
  return resultado
}

export default function BuscarWoModal({ isOpen, onClose, onSeleccionar }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [recientes, setRecientes] = useState([])
  const ultimaConsulta = useRef(0)

  useEffect(() => {
    if (isOpen) {
      setTexto('')
      setResultados([])
      setRecientes(leerRecientes())
    }
  }, [isOpen])

  useEffect(() => {
    const consulta = texto.trim()
    if (!consulta) {
      setResultados([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    const id = ++ultimaConsulta.current
    const timer = setTimeout(async () => {
      try {
        const res = await buscarLocal(consulta)
        if (id === ultimaConsulta.current) setResultados(res)
      } catch {
        if (id === ultimaConsulta.current) setResultados([])
      } finally {
        if (id === ultimaConsulta.current) setBuscando(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [texto])

  function elegir(item) {
    guardarReciente(item)
    onSeleccionar(item)
    onClose()
  }

  const hayTexto = texto.trim().length > 0
  const lista = hayTexto ? resultados : recientes

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={open => { if (!open) onClose() }}
      placement="top"
      size="md"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>Buscar WO</ModalHeader>
        <ModalBody className="pb-5">
          <Input
            autoFocus
            value={texto}
            onValueChange={setTexto}
            placeholder="WO, ID, site, distrito o legajo"
            aria-label="Buscar WO"
            startContent={<Search size={16} className="text-default-400" />}
            endContent={texto ? (
              <button
                type="button"
                className="cursor-pointer text-default-400 hover:text-default-600"
                onClick={() => setTexto('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            ) : undefined}
          />

          {!hayTexto && recientes.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-default-400">
              <Clock size={12} /> Recientes
            </p>
          )}

          {buscando && lista.length === 0 ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : lista.length === 0 ? (
            <p className="py-4 text-center text-sm text-default-400">
              {hayTexto ? 'Sin resultados.' : 'Escribe para buscar por WO, ID, site, distrito o legajo.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {lista.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => elegir(item)}
                    className="w-full cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-default-100"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{item.wo}</span>
                      <span className="text-xs text-default-400">{formatearFecha(item.fecha)}</span>
                    </span>
                    <span className="block truncate text-xs text-default-500">
                      {[item.site, item.codigo_equipo, item.distrito, item.legajo].filter(Boolean).join(' · ') || 'Sin datos'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

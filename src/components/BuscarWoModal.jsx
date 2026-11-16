import { useState, useEffect, useRef } from 'react'
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Spinner, Select, SelectItem, Button,
} from '@heroui/react'
import { Search, X, Clock } from 'lucide-react'
import { db } from '../lib/db'
import { formatearFecha } from '../lib/date'
import {
  coincideFiltros, hayFiltros, hoyLima, normalizarLegajo, rangoSemana, nombreDeWo,
} from '../lib/wosTecnicos'

const DEBOUNCE_MS = 300
const MAX_RESULTADOS = 30
const MAX_RECIENTES = 8
const CLAVE_RECIENTES = 'wos_busqueda_recientes'

const FILTROS_VACIOS = { texto: '', desde: '', hasta: '', legajo: '' }

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

// Busca en la caché local (Dexie) por texto, rango de fechas y técnico/legajo
async function buscarLocal(filtros, nombres) {
  const todas = await db.workorders.toArray()
  const resultado = []
  let total = 0
  for (const w of todas) {
    if (!coincideFiltros(w, filtros, nombres)) continue
    total += 1
    if (resultado.length < MAX_RESULTADOS) {
      resultado.push({
        id: w.idRemoto,
        wo: w.wo,
        fecha: w.fecha,
        codigo_equipo: w.codigoEquipo,
        site: w.site || w.nombreEquipo || '',
        legajo: w.legajo,
        distrito: w.distrito,
        tecnico: nombreDeWo(w, nombres),
      })
    }
  }
  resultado.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  return { resultado, total }
}

export default function BuscarWoModal({ isOpen, onClose, onSeleccionar, onAplicar, nombres = {}, filtrosIniciales }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [resultados, setResultados] = useState([])
  const [total, setTotal] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [recientes, setRecientes] = useState([])
  const [opcionesTecnico, setOpcionesTecnico] = useState([])
  const ultimaConsulta = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    setFiltros(filtrosIniciales || FILTROS_VACIOS)
    setResultados([])
    setTotal(0)
    setRecientes(leerRecientes())
    db.workorders.toArray().then(todas => {
      const porLegajo = new Map()
      for (const w of todas) {
        const clave = normalizarLegajo(w.legajo)
        if (!clave) continue
        const actual = porLegajo.get(clave) || { legajo: w.legajo, nombres: new Set() }
        const nombre = nombreDeWo(w, nombres)
        if (nombre) actual.nombres.add(nombre)
        porLegajo.set(clave, actual)
      }
      setOpcionesTecnico(
        [...porLegajo.entries()]
          .map(([clave, v]) => ({
            clave,
            etiqueta: [v.legajo, [...v.nombres].join(', ')].filter(Boolean).join(' · '),
          }))
          .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
      )
    }).catch(() => setOpcionesTecnico([]))
    // Se inicializa solo al abrir el modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const activos = hayFiltros(filtros)

  useEffect(() => {
    if (!activos) {
      setResultados([])
      setTotal(0)
      setBuscando(false)
      return
    }
    setBuscando(true)
    const id = ++ultimaConsulta.current
    const timer = setTimeout(async () => {
      try {
        const { resultado, total: n } = await buscarLocal(filtros, nombres)
        if (id === ultimaConsulta.current) {
          setResultados(resultado)
          setTotal(n)
        }
      } catch {
        if (id === ultimaConsulta.current) {
          setResultados([])
          setTotal(0)
        }
      } finally {
        if (id === ultimaConsulta.current) setBuscando(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filtros, activos, nombres])

  const cambiar = campo => valor => setFiltros(prev => ({ ...prev, [campo]: valor }))

  function atajoHoy() {
    const hoy = hoyLima()
    setFiltros(prev => ({ ...prev, desde: hoy, hasta: hoy }))
  }

  function atajoSemana() {
    setFiltros(prev => ({ ...prev, ...rangoSemana(hoyLima()) }))
  }

  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta)

  function elegir(item) {
    guardarReciente(item)
    onSeleccionar(item)
    onClose()
  }

  function aplicarALista() {
    onAplicar?.(filtros)
    onClose()
  }

  const lista = activos ? resultados : recientes

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
        <ModalBody className="pb-3">
          <Input
            autoFocus
            value={filtros.texto}
            onValueChange={cambiar('texto')}
            placeholder="WO, ID, site, distrito, legajo o técnico"
            aria-label="Buscar WO"
            startContent={<Search size={16} className="text-default-400" />}
            endContent={filtros.texto ? (
              <button
                type="button"
                className="cursor-pointer text-default-400 hover:text-default-600"
                onClick={() => cambiar('texto')('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            ) : undefined}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              label="Desde"
              size="sm"
              value={filtros.desde}
              onValueChange={cambiar('desde')}
              isInvalid={rangoInvalido}
            />
            <Input
              type="date"
              label="Hasta"
              size="sm"
              value={filtros.hasta}
              onValueChange={cambiar('hasta')}
              isInvalid={rangoInvalido}
              errorMessage={rangoInvalido ? 'Debe ser posterior a «Desde».' : undefined}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={atajoHoy}>Hoy</Button>
            <Button size="sm" variant="flat" onPress={atajoSemana}>Esta semana</Button>
            {(filtros.desde || filtros.hasta) && (
              <Button
                size="sm"
                variant="light"
                onPress={() => setFiltros(prev => ({ ...prev, desde: '', hasta: '' }))}
              >
                Quitar fechas
              </Button>
            )}
          </div>

          <Select
            label="Técnico / legajo"
            size="sm"
            selectedKeys={filtros.legajo ? [filtros.legajo] : []}
            onSelectionChange={keys => cambiar('legajo')(Array.from(keys)[0] || '')}
            items={opcionesTecnico}
            isDisabled={opcionesTecnico.length === 0}
            placeholder="Todos"
          >
            {o => <SelectItem key={o.clave}>{o.etiqueta}</SelectItem>}
          </Select>
          {filtros.legajo && (
            <Button
              size="sm"
              variant="light"
              className="self-start"
              onPress={() => cambiar('legajo')('')}
            >
              Quitar técnico
            </Button>
          )}

          {!activos && recientes.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-default-400">
              <Clock size={12} /> Recientes
            </p>
          )}

          {buscando && lista.length === 0 ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : lista.length === 0 ? (
            <p className="py-4 text-center text-sm text-default-400">
              {activos ? 'Sin resultados.' : 'Escribe o elige una fecha o un técnico para buscar.'}
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
                      {[item.site, item.codigo_equipo, item.distrito].filter(Boolean).join(' · ') || 'Sin datos'}
                    </span>
                    {(item.tecnico || item.legajo) && (
                      <span className="block truncate text-xs text-default-400">
                        {[item.tecnico, item.legajo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
        {activos && onAplicar && (
          <ModalFooter className="pt-0">
            <Button variant="light" onPress={() => setFiltros(FILTROS_VACIOS)}>Limpiar</Button>
            <Button
              color="primary"
              onPress={aplicarALista}
              isDisabled={rangoInvalido || total === 0}
            >
              Ver {total} en la lista
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  )
}

import { useState } from 'react'
import TimePicker from 'react-time-picker'
import 'react-time-picker/dist/TimePicker.css'
import {
  Card, CardBody, CardHeader, Input, Button,
  Chip, Divider, ScrollShadow
} from '@heroui/react'
import { Search, Clock, MapPin } from 'lucide-react'

const chipColor = (id) => {
  if (!id) return 'default'
  if (id.startsWith('C')) return 'warning'
  if (id.startsWith('K')) return 'primary'
  return 'default'
}

function CampoInfo({ label, valor, mono = false, copiable = false, onCopiar }) {
  return (
    <div
      className={copiable ? 'cursor-copy active:opacity-70' : ''}
      onClick={copiable ? onCopiar : undefined}
      role={copiable ? 'button' : undefined}
      tabIndex={copiable ? 0 : undefined}
      onKeyDown={copiable ? (e) => (e.key === 'Enter' || e.key === ' ') && onCopiar?.() : undefined}
      title={copiable ? `Toca para copiar ${label}` : undefined}
    >
      <p className="text-xs text-default-400 mb-1">{label}</p>
      <p className={`text-sm font-medium text-default-800 ${mono ? 'font-mono' : ''}`}>
        {valor || <span className="text-default-300">—</span>}
      </p>
    </div>
  )
}

function SelectorHora({ label, value, onChange, onAhora }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-default-100 last:border-0">
      <span className="w-16 text-sm font-medium text-default-600 shrink-0">{label}</span>
      <div className="flex-1 border border-default-200 rounded-xl px-3 py-2 bg-default-50">
        <TimePicker
          onChange={onChange}
          value={value}
          disableClock={false}
          clearIcon={null}
          format="HH:mm"
          className="w-full"
        />
      </div>
      <Button
        size="sm"
        color="primary"
        variant="solid"
        radius="lg"
        onPress={onAhora}
        startContent={<Clock size={12} />}
        className="shrink-0"
      >
        Ahora
      </Button>
    </div>
  )
}

export default function FormularioCierre({ tareas }) {
  const [busqueda, setBusqueda] = useState('')
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [mostrarLista, setMostrarLista] = useState(false)
  const [ds, setDs] = useState(null)
  const [arribo, setArribo] = useState(null)
  const [inicio, setInicio] = useState(null)
  const [fin, setFin] = useState(null)
  const [retorno, setRetorno] = useState(null)
  const [ultimaAtencion, setUltimaAtencion] = useState(false)

  const tareasFiltradas = tareas.filter(t => {
    const q = busqueda.toLowerCase()
    return (
      t.nombre?.toLowerCase().includes(q) ||
      t.wo?.toLowerCase().includes(q) ||
      t.distrito?.toLowerCase().includes(q) ||
      t.id_atm?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  function seleccionarTarea(tarea) {
    setTareaSeleccionada(tarea)
    setBusqueda(tarea.nombre)
    setMostrarLista(false)
    setDs(null); setArribo(null); setInicio(null); setFin(null); setRetorno(null)
  }

  function ahora() {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function calcularRetorno(horaFin, esUltima) {
    if (!horaFin) return
    const [h, m] = horaFin.split(':').map(Number)
    const total = h * 60 + m + (esUltima ? 60 : 20)
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    setRetorno(`${hh}:${mm}`)
  }

  function handleFin(v) { setFin(v); if (v) calcularRetorno(v, ultimaAtencion) }
  function handleUltima(esUltima) { setUltimaAtencion(esUltima); if (fin) calcularRetorno(fin, esUltima) }

  async function copiarTexto(texto, etiqueta = 'valor') {
    if (!texto) return

    const valor = String(texto)

    try {
      await navigator.clipboard.writeText(valor)
      // opcional: reemplaza con toast si tienes uno
      console.log(`${etiqueta} copiado:`, valor)
    } catch {
      // fallback para algunos navegadores/contextos
      const ta = document.createElement('textarea')
      ta.value = valor
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      console.log(`${etiqueta} copiado (fallback):`, valor)
    }
  }

  return (
    <div className="space-y-4">

      {/* Selector */}
      <Card shadow="sm" className="overflow-visible">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex justify-between w-full items-center">
            <p className="text-sm font-semibold">Seleccionar tarea</p>
          </div>
          <Input
            placeholder="Buscar agencia, WO, distrito..."
            value={busqueda}
            onValueChange={v => { setBusqueda(v); setMostrarLista(true); if (!v) setTareaSeleccionada(null) }}
            onFocus={() => setMostrarLista(true)}
            startContent={<Search size={14} className="text-default-400" />}
            variant="bordered"
            radius="lg"
            size="md"
          />
        </CardHeader>
        {/* <Divider className="mt-3" /> */}
        <CardBody className='overflow-visible'>
          <ScrollShadow className="max-h-[60vh]">
            <div className="relative">

              {mostrarLista && busqueda && tareasFiltradas.length > 0 && (
                <div className=" w-full mt-1 bg-white border border-default-200
                rounded-xl shadow-lg overflow-hidden">
                  {tareasFiltradas.map((t, i) => (
                    <div key={i} onClick={() => seleccionarTarea(t)}
                      className="px-3 py-3 hover:bg-primary-50 cursor-pointer border-b
                      border-default-100 last:border-0 transition-colors">
                      <div className="flex items-center justify-between">
                        <Chip size="sm" variant="flat" color={chipColor(t.id_atm)}
                          className="font-mono text-xs">{t.id_atm}</Chip>
                        <span className="text-xs font-mono text-default-400">{t.wo}</span>
                      </div>
                      <p className="text-sm font-medium text-default-700 mt-1">{t.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-default-400">
                          <MapPin size={10} />{t.distrito}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-default-400">
                          <Clock size={10} />{t.hora}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollShadow>
        </CardBody>
      </Card>

      {/* Datos ATM */}
      {tareaSeleccionada && (
        <>
          <Card shadow="sm">
            <CardHeader className="flex justify-between pb-0">
              <p className="text-sm font-semibold">Datos del ATM</p>
              <button
                type="button"
                onClick={() => copiarTexto(tareaSeleccionada.id_atm, 'ID ATM')}
                className="rounded-medium cursor-copy active:scale-95 transition-transform"
                title="Toca para copiar ID ATM"
              >
                <Chip
                  size="sm"
                  variant="flat"
                  color={chipColor(tareaSeleccionada.id_atm)}
                  className="font-mono"
                >
                  {tareaSeleccionada.id_atm}
                </Chip>
              </button>
            </CardHeader>
            <Divider className="mt-3" />
            <CardBody>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <CampoInfo
                  label="WO"
                  valor={tareaSeleccionada.wo}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.wo, 'WO')}
                />
                <CampoInfo
                  label="Modelo"
                  valor={tareaSeleccionada.modelo}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.modelo, 'Modelo')}
                />
                <CampoInfo
                  label="Serie"
                  valor={tareaSeleccionada.serie}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.serie, 'Serie')}
                />
                <CampoInfo label="Fecha" valor={tareaSeleccionada.fecha} />
                <CampoInfo
                  label="Dirección"
                  valor={tareaSeleccionada.direccion}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.direccion, 'Dirección')}
                />
                <CampoInfo
                  label="Agencia"
                  valor={tareaSeleccionada.nombre}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.nombre, 'Agencia')}
                />
              </div>

            </CardBody>
          </Card>

          {/* Tiempos */}
          <Card shadow="sm">
            <CardHeader className="pb-0">
              <p className="text-sm font-semibold">Registro de tiempos</p>
            </CardHeader>
            <Divider className="mt-3" />
            <CardBody>
              <SelectorHora label="DS" value={ds} onChange={setDs} onAhora={() => setDs(ahora())} />
              <SelectorHora label="Arribo" value={arribo} onChange={setArribo} onAhora={() => setArribo(ahora())} />
              <SelectorHora label="Inicio" value={inicio} onChange={setInicio} onAhora={() => setInicio(ahora())} />
              <SelectorHora label="Fin" value={fin} onChange={handleFin} onAhora={() => handleFin(ahora())} />

              {/* Retorno */}
              <div className="pt-3">
                <div className="bg-default-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-default-600">Retorno</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" radius="lg" variant={!ultimaAtencion ? 'solid' : 'bordered'}
                        color={!ultimaAtencion ? 'primary' : 'default'}
                        onPress={() => handleUltima(false)}>+20 min</Button>
                      <Button size="sm" radius="lg" variant={ultimaAtencion ? 'solid' : 'bordered'}
                        color={ultimaAtencion ? 'primary' : 'default'}
                        onPress={() => handleUltima(true)}>+1 hora</Button>
                    </div>
                  </div>
                  <div className="border border-default-200 rounded-xl px-3 py-2 bg-white">
                    <TimePicker onChange={setRetorno} value={retorno}
                      disableClock={false} clearIcon={null} format="HH:mm" className="w-full" />
                  </div>
                </div>
              </div>

              {/* Resumen */}
              {(ds || arribo || inicio || fin || retorno) && (
                <div className="mt-4 bg-default-900 rounded-xl p-4">
                  <p className="text-xs text-default-500 font-mono uppercase tracking-wider mb-3">
                    Resumen
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {[['DS', ds], ['Arribo', arribo], ['Inicio', inicio], ['Fin', fin], ['Retorno', retorno]]
                      .filter(([, v]) => v)
                      .map(([label, valor]) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-xs text-default-500 w-14">{label}</span>
                          <span className="text-sm font-mono font-semibold text-white">{valor}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
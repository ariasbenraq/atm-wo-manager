import { useState } from 'react'
import TimePicker from 'react-time-picker'
import 'react-time-picker/dist/TimePicker.css'
import {
  Card, CardBody, CardHeader, Input, Button,
  Chip, Divider, ScrollShadow, Modal, ModalContent,
  ModalHeader, ModalBody, ModalFooter
} from '@heroui/react'
import { ArrowLeft, Search, Clock, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { formatearFecha, formatearFechaHora } from '../lib/date'

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

function CampoResumen({ label, valor, mono = false }) {
  return (
    <div className="min-w-0 rounded-lg bg-default-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-default-400">{label}</p>
      <p className={`truncate text-sm font-medium text-default-700 ${mono ? 'font-mono' : ''}`}>
        {valor || '—'}
      </p>
    </div>
  )
}

function formatearHoraYFecha(hora, fecha) {
  const fechaTexto = formatearFecha(fecha)
  return [hora, fechaTexto].filter(Boolean).join(' · ')
}

function obtenerMarcaTiempoTarea(tarea) {
  const fecha = String(tarea?.fecha || '').trim()
  const hora = String(tarea?.hora || '').trim() || '00:00'

  if (!fecha) return 0

  const matchIso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matchIso) return 0

  const [, year, month, day] = matchIso
  const marca = new Date(`${year}-${month}-${day}T${hora.length === 5 ? `${hora}:00` : hora}`)
  return Number.isNaN(marca.getTime()) ? 0 : marca.getTime()
}

export default function FormularioCierre({ tareas, onMarcarCompletada, onEliminarTarea }) {
  const [busqueda, setBusqueda] = useState('')
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [mostrarLista, setMostrarLista] = useState(true)
  const [completadasExpandidas, setCompletadasExpandidas] = useState([])
  const [confirmacion, setConfirmacion] = useState(null)
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
      t.ce?.toLowerCase().includes(q) ||
      t.distrito?.toLowerCase().includes(q) ||
      t.id_atm?.toLowerCase().includes(q)
    )
  })
  const tareasPendientes = tareasFiltradas
    .filter(t => t.estado !== 'completada')
    .sort((a, b) => obtenerMarcaTiempoTarea(a) - obtenerMarcaTiempoTarea(b))
  const tareasCompletadas = tareasFiltradas
    .filter(t => t.estado === 'completada')
    .sort((a, b) => obtenerMarcaTiempoTarea(a) - obtenerMarcaTiempoTarea(b))
  const pendientesVisibles = (busqueda ? tareasPendientes : tareasPendientes.slice(0, 8))
  const completadasVisibles = (busqueda ? tareasCompletadas : tareasCompletadas.slice(0, 8))

  function seleccionarTarea(tarea) {
    setTareaSeleccionada(tarea)
    setBusqueda(tarea.nombre)
    setMostrarLista(false)
    setDs(null); setArribo(null); setInicio(null); setFin(null); setRetorno(null)
  }

  function limpiarSeleccion() {
    setTareaSeleccionada(null)
    setBusqueda('')
    setMostrarLista(true)
    setDs(null); setArribo(null); setInicio(null); setFin(null); setRetorno(null)
  }

  function alternarCompletada(wo) {
    if (!wo) return

    setCompletadasExpandidas(prev => (
      prev.includes(wo)
        ? prev.filter(item => item !== wo)
        : [...prev, wo]
    ))
  }

  function abrirConfirmacion(tipo, tarea) {
    if (!tarea?.wo) return

    setConfirmacion({ tipo, tarea })
  }

  function cerrarConfirmacion() {
    setConfirmacion(null)
  }

  function ejecutarConfirmacion() {
    if (!confirmacion?.tarea?.wo) return

    const { tipo, tarea } = confirmacion

    if (tipo === 'completar') {
      onMarcarCompletada?.(tarea.wo)
    }

    if (tipo === 'eliminar') {
      onEliminarTarea?.(tarea.wo)
    }

    if (tareaSeleccionada?.wo === tarea.wo) {
      limpiarSeleccion()
    }

    cerrarConfirmacion()
  }

  function obtenerTextoConfirmacion() {
    if (!confirmacion?.tarea) return null

    const { tipo, tarea } = confirmacion
    const nombre = tarea.nombre || 'esta agencia'

    if (tipo === 'completar') {
      return {
        titulo: 'Marcar tarea como completada',
        descripcion: `La tarea ${tarea.wo} de ${nombre} dejara de aparecer en pendientes y pasara a completadas.`,
        boton: 'Confirmar completada',
        color: 'success',
      }
    }

    return {
      titulo: 'Eliminar tarea de Mis tareas',
      descripcion: `La tarea ${tarea.wo} de ${nombre} se quitara de tu asignacion local y dejara de mostrarse en este apartado.`,
      boton: 'Confirmar eliminacion',
      color: 'danger',
    }
  }

  function marcarCompletada(tarea) {
    if (!tarea?.wo) return
    abrirConfirmacion('completar', tarea)
  }

  function eliminarTarea(tarea) {
    if (!tarea?.wo) return
    abrirConfirmacion('eliminar', tarea)
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

  const textoConfirmacion = obtenerTextoConfirmacion()

  return (
    <div className="space-y-4">

      <Card shadow="sm" className="overflow-visible">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex justify-between w-full items-center">
            <p className="text-sm font-semibold">Mis tareas</p>
            <Chip size="sm" variant="flat" color="default">
              {tareasPendientes.length} pendiente{tareasPendientes.length === 1 ? '' : 's'}
            </Chip>
          </div>
          <Input
            placeholder="Buscar agencia, WO, usuario o distrito..."
            value={busqueda}
            onValueChange={v => { setBusqueda(v); setMostrarLista(true); if (!v && tareaSeleccionada?.estado === 'completada') limpiarSeleccion() }}
            onFocus={() => setMostrarLista(true)}
            startContent={<Search size={14} className="text-default-400" />}
            variant="bordered"
            radius="lg"
            size="md"
          />
        </CardHeader>
        <CardBody className="overflow-visible space-y-4">
          {tareas.length === 0 && (
            <div className="rounded-xl border border-dashed border-default-200 bg-default-50 px-4 py-6 text-center text-sm text-default-400">
              No tienes tareas en este apartado.
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-default-700">Pendientes</p>
              <Chip size="sm" variant="flat" color="warning">
                {tareasPendientes.length}
              </Chip>
            </div>
            {mostrarLista && pendientesVisibles.length > 0 && (
              <ScrollShadow className="max-h-[60vh]">
                <div className="space-y-3">
                  {pendientesVisibles.map((t, i) => (
                    <Card
                      key={t.wo || i}
                      shadow="sm"
                      className="border border-default-200/80 bg-white"
                    >
                      <CardBody className="p-4">
                        <div className="rounded-lg px-1 py-1">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-default-800">{t.nombre}</p>
                              <p className="mt-1 text-xs text-default-500">
                                Datos principales para gestionar la tarea
                              </p>
                            </div>
                            <Chip size="sm" variant="flat" color={chipColor(t.id_atm)}
                              className="shrink-0 font-mono text-xs">
                              {t.id_atm || 'Sin ATM'}
                            </Chip>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <CampoResumen label="WO" valor={t.wo} mono />
                            <CampoResumen label="Hora" valor={t.hora} mono />
                            <CampoResumen label="Fecha" valor={formatearFecha(t.fecha)} mono />
                            <CampoResumen label="CE" valor={t.ce || 'Sin usuario'} />
                            <CampoResumen label="Distrito" valor={t.distrito} />
                            <CampoResumen label="Dirección" valor={t.direccion} />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            radius="lg"
                            onPress={() => seleccionarTarea(t)}
                          >
                            Ver detalle
                          </Button>
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            radius="lg"
                            startContent={<CheckCircle2 size={14} />}
                            onPress={() => marcarCompletada(t)}
                          >
                            Marcar completada
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            radius="lg"
                            startContent={<Trash2 size={14} />}
                            onPress={() => eliminarTarea(t)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </ScrollShadow>
            )}
            {mostrarLista && pendientesVisibles.length === 0 && (
              <div className="rounded-xl border border-default-200 bg-white px-4 py-4 text-sm text-default-400 shadow-sm">
                {busqueda
                  ? `No se encontraron tareas pendientes para "${busqueda}".`
                  : 'No hay tareas pendientes.'}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-default-700">Completadas</p>
              <Chip size="sm" variant="flat" color="success">
                {tareasCompletadas.length}
              </Chip>
            </div>
            {completadasVisibles.length > 0 ? (
              <div className="space-y-3">
                {completadasVisibles.map((t, i) => (
                  <Card
                    key={t.wo || i}
                    shadow="sm"
                    className="border border-default-200/80 bg-white"
                  >
                    <CardBody className="p-4">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => alternarCompletada(t.wo)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-default-700">{t.nombre}</p>
                            <p className="mt-1 text-xs text-default-400">
                              Completada {t.completadaEn ? formatearFechaHora(t.completadaEn) : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip size="sm" variant="flat" color="success" className="shrink-0">
                              Completada
                            </Chip>
                            <span className="text-default-400">
                              {completadasExpandidas.includes(t.wo) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </div>
                        </div>
                      </button>

                      {completadasExpandidas.includes(t.wo) && (
                        <>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <CampoResumen label="WO" valor={t.wo} mono />
                            <CampoResumen label="Hora" valor={t.hora} mono />
                            <CampoResumen label="Fecha" valor={formatearFecha(t.fecha)} mono />
                            <CampoResumen label="CE" valor={t.ce || 'Sin usuario'} />
                            <CampoResumen label="Distrito" valor={t.distrito} />
                            <CampoResumen label="Dirección" valor={t.direccion} />
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              color="danger"
                              variant="flat"
                              radius="lg"
                              startContent={<Trash2 size={14} />}
                              onPress={() => eliminarTarea(t)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-default-200 bg-white px-4 py-4 text-sm text-default-400 shadow-sm">
                {busqueda
                  ? `No se encontraron tareas completadas para "${busqueda}".`
                  : 'Aun no hay tareas completadas.'}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {tareaSeleccionada && (
        <>
          <Card shadow="sm">
            <CardHeader className="flex flex-col gap-3 pb-0">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">Detalle de tarea</p>
                  <div className="flex shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => copiarTexto(tareaSeleccionada.id_atm, 'ID ATM')}
                      className="w-fit rounded-medium cursor-copy active:scale-95 transition-transform"
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
                  </div>
                </div>
                <p className="mt-1 text-xs text-default-400">
                  Acciones y datos completos de la tarea seleccionada.
                </p>
                <Button
                  size="sm"
                  color="default"
                  variant="flat"
                  radius="lg"
                  className="mt-3"
                  startContent={<ArrowLeft size={14} />}
                  onPress={limpiarSeleccion}
                >
                  Volver a lista
                </Button>
              </div>
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
                <CampoInfo label="Hora" valor={tareaSeleccionada.hora} mono />
                <CampoInfo label="Fecha" valor={formatearFecha(tareaSeleccionada.fecha)} />
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
                <CampoInfo
                  label="Usuario asignado"
                  valor={tareaSeleccionada.ce}
                  copiable
                  onCopiar={() => copiarTexto(tareaSeleccionada.ce, 'Usuario asignado')}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-default-100 pt-4">
                <Button
                  size="sm"
                  color="success"
                  variant="flat"
                  radius="lg"
                  startContent={<CheckCircle2 size={14} />}
                  onPress={() => marcarCompletada(tareaSeleccionada)}
                >
                  Marcar completada
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  radius="lg"
                  startContent={<Trash2 size={14} />}
                  onPress={() => eliminarTarea(tareaSeleccionada)}
                >
                  Eliminar
                </Button>
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

      <Modal isOpen={Boolean(confirmacion)} onOpenChange={abierto => !abierto && cerrarConfirmacion()}>
        <ModalContent>
          <>
            <ModalHeader>{textoConfirmacion?.titulo}</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">{textoConfirmacion?.descripcion}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={cerrarConfirmacion}>
                Cancelar
              </Button>
              <Button color={textoConfirmacion?.color} onPress={ejecutarConfirmacion}>
                {textoConfirmacion?.boton}
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  )
}

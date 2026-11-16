import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { refrescarCacheWos, leerCacheWos, wosADexie } from '../lib/wosCache'
import { db } from '../lib/db'
import { formatearFecha } from '../lib/date'
import { formatMes } from '../lib/excel'
import { useLegajo } from '../hooks/useLegajo'
import {
  hoyLima, normalizarLegajo, cargarNombresTecnicos, coincideFiltros, hayFiltros, nombreDeWo,
} from '../lib/wosTecnicos'
import ImportarWosExcel from '../components/ImportarWosExcel'
import WosSkeleton from '../components/WosSkeleton'
import WoCard from '../components/WoCard'
import BuscarWoModal from '../components/BuscarWoModal'
import AppShell from '../components/AppShell'
import {
  Chip, Fab, Sheet, Button as KonstaButton,
} from 'konsta/react'
import {
  Input, Button, Switch, Select, SelectItem, Pagination,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import { Plus, X, Check, FileSpreadsheet, FilePlus2, Search } from 'lucide-react'

const CAMPOS_DETALLE = [
  ['Año', 'anio'],
  ['Mes', 'mes'],
  ['Cliente', 'cliente'],
  ['N° de Serie', 'serie'],
  ['Modelo', 'modelo'],
  ['Tipo PM', 'tipo_pm'],
  ['Código del Equipo', 'codigo_equipo'],
  ['Nombre del Equipo', 'nombre_equipo'],
  ['Site', 'site'],
  ['Dirección', 'direccion'],
  ['Distrito', 'distrito'],
  ['Provincia', 'provincia'],
  ['Departamento', 'departamento'],
  ['L/P', 'lp'],
  ['Función ATM', 'funcion_atm'],
  ['Horario con PV', 'horario_pv'],
  ['Restricciones / Documentación', 'restricciones'],
  ['Responsable Bóveda', 'responsable_boveda'],
  ['WO', 'wo'],
  ['Fecha', '__fecha'],
  ['Hora', 'hora'],
  ['Hora PV', 'hora_pv'],
  ['Legajo', 'legajo'],
  ['CE', 'ce'],
  ['DNI', 'dni'],
]

const MESES_RETENCION = 6
const DIAS_POSPONER = 7
const CLAVE_LIMPIEZA = 'wos_limpieza_pospuesta'

const CLIENTES_MANUALES = ['Banco de Crédito', 'Interbank', 'BBVA', 'Banco Nación']

const MODELOS_MANUALES = [
  '6623-2000-8200',
  '6627-3000-8200',
  '2062-2050-8608',
  '2004-2000-8600',
  '6623-2051-8200',
  '6627-4000-8200',
  '6626-3000-8600',
  '6627-3050-8200',
  '6683-2000-8607',
]

// Convierte la hora (texto libre del Excel: "9:05", "09:05:00", "3:00 PM") a minutos para ordenar
function horaAMinutos(hora) {
  const match = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?/i)
  if (!match) return null
  let horas = Number(match[1]) % 24
  const sufijo = match[3]?.toLowerCase()
  if (sufijo === 'p' && horas < 12) horas += 12
  if (sufijo === 'a' && horas === 12) horas = 0
  return horas * 60 + Number(match[2])
}

function compararHora(a, b) {
  const ma = horaAMinutos(a)
  const mb = horaAMinutos(b)
  if (ma === null && mb === null) return 0
  if (ma === null) return 1
  if (mb === null) return -1
  return ma - mb
}

function resumenFiltros(f, nombres, wos) {
  const partes = []
  if (f.texto?.trim()) partes.push(`«${f.texto.trim()}»`)
  if (f.desde || f.hasta) {
    partes.push(f.desde === f.hasta ? formatearFecha(f.desde) : `${f.desde ? formatearFecha(f.desde) : '…'} – ${f.hasta ? formatearFecha(f.hasta) : '…'}`)
  }
  if (f.legajo) {
    const w = wos.find(x => normalizarLegajo(x.legajo) === f.legajo)
    partes.push([w?.legajo, w && nombres[w.user_id]].filter(Boolean).join(' · ') || f.legajo)
  }
  return partes.join(' · ')
}

function fechaEstado(fecha) {
  if (!fecha) return null
  const hoy = hoyLima()
  if (fecha === hoy) return 'hoy'
  return fecha < hoy ? 'pasado' : 'futuro'
}

export default function WosPage() {
  const { session } = useApp()
  const userId = session?.user?.id
  const legajoUsuario = useLegajo()

  const [wos, setWos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [seleccion, setSeleccion] = useState(null)
  const [buscarAbierto, setBuscarAbierto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)
  const [soloMios, setSoloMios] = useState(false)
  const [filtroHoy, setFiltroHoy] = useState(false)
  const [filtrosBusqueda, setFiltrosBusqueda] = useState(null)
  const [nombres, setNombres] = useState({})

  const [fabAbierto, setFabAbierto] = useState(false)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [formWo, setFormWo] = useState('')
  const [formCliente, setFormCliente] = useState('')
  const [formId, setFormId] = useState('')
  const [formSerie, setFormSerie] = useState('')
  const [formModelo, setFormModelo] = useState('')
  const [formNombreEquipo, setFormNombreEquipo] = useState('')
  const [formFecha, setFormFecha] = useState('')
  const [errorForm, setErrorForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const opcionesCliente = [
    ...new Set([...CLIENTES_MANUALES, ...wos.map(w => w.cliente).filter(Boolean)]),
  ]

  const [detalle, setDetalle] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [eliminandoConfirmado, setEliminandoConfirmado] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await refrescarCacheWos()
      setWos(data)
    } catch {
      try {
        setWos(await leerCacheWos())
        setMensaje({ color: 'warning', texto: "Sin conexión. Mostrando las Wo's locales." })
      } catch { /* silent */ }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    let activo = true
    cargarNombresTecnicos().then(n => { if (activo) setNombres(n) })
    return () => { activo = false }
  }, [wos])

  // WOs propias importadas hace más de 6 meses (candidatas a limpieza)
  const wosAntiguas = useMemo(() => {
    const limite = new Date()
    limite.setMonth(limite.getMonth() - MESES_RETENCION)
    return wos.filter(w => w.user_id === userId && w.created_at && new Date(w.created_at) < limite)
  }, [wos, userId])

  const [limpiezaPospuesta, setLimpiezaPospuesta] = useState(() => {
    try {
      const t = Number(localStorage.getItem(CLAVE_LIMPIEZA) || 0)
      return Date.now() - t < DIAS_POSPONER * 86400000
    } catch { return false }
  })
  const [limpiezaAbierta, setLimpiezaAbierta] = useState(false)
  const [limpiando, setLimpiando] = useState(false)

  function posponerLimpieza() {
    try { localStorage.setItem(CLAVE_LIMPIEZA, String(Date.now())) } catch { /* sin almacenamiento */ }
    setLimpiezaPospuesta(true)
  }

  async function eliminarAntiguas() {
    if (!wosAntiguas.length || !userId) return
    setLimpiando(true)
    try {
      const ids = wosAntiguas.map(w => w.id)
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await supabase
          .from('workorders')
          .delete()
          .in('id', ids.slice(i, i + 100))
          .eq('user_id', userId)
        if (error) throw error
      }
      const set = new Set(ids)
      setWos(prev => prev.filter(w => !set.has(w.id)))
      try {
        await db.workorders.filter(w => set.has(w.idRemoto)).delete()
      } catch { /* silent */ }
      setMensaje({ color: 'success', texto: `${ids.length} WO${ids.length === 1 ? '' : 's'} antigua${ids.length === 1 ? '' : 's'} eliminada${ids.length === 1 ? '' : 's'}.` })
      setLimpiezaAbierta(false)
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudieron eliminar las WOs antiguas.' })
    } finally {
      setLimpiando(false)
    }
  }

  const wosFiltradas = useMemo(() => {
    let resultado = wos
    if (seleccion) {
      resultado = resultado.filter(w => w.id === seleccion.id)
    }
    const hoy = hoyLima()
    const fechaFiltro = filtroHoy ? hoy : ''
    if (fechaFiltro) {
      resultado = resultado.filter(w => w.fecha === fechaFiltro)
    }
    if (hayFiltros(filtrosBusqueda)) {
      resultado = resultado.filter(w => coincideFiltros(w, filtrosBusqueda, nombres))
    }
    if (soloMios) {
      const mio = normalizarLegajo(legajoUsuario)
      resultado = resultado.filter(w => normalizarLegajo(w.legajo) === mio)
    }
    // Hoy y lo más próximo hacia el futuro (fecha y hora ascendente); las pasadas al final, de la más reciente a la más antigua
    return [...resultado].sort((a, b) => {
      const fa = String(a.fecha || '')
      const fb = String(b.fecha || '')
      const pasadaA = fa < hoy
      const pasadaB = fb < hoy
      if (pasadaA !== pasadaB) return pasadaA ? 1 : -1
      const cmpFecha = fa.localeCompare(fb)
      if (cmpFecha !== 0) return pasadaA ? -cmpFecha : cmpFecha
      const cmpHora = compararHora(a.hora, b.hora)
      if (cmpHora !== 0) return cmpHora
      return String(a.wo || '').localeCompare(String(b.wo || ''))
    })
  }, [wos, seleccion, filtroHoy, soloMios, filtrosBusqueda, nombres, legajoUsuario])

  const totalPaginas = Math.max(1, Math.ceil(wosFiltradas.length / tamanoPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const wosPagina = wosFiltradas.slice(
    (paginaSegura - 1) * tamanoPagina,
    paginaSegura * tamanoPagina
  )

  useEffect(() => { setPagina(1) }, [seleccion, tamanoPagina, filtroHoy, soloMios, filtrosBusqueda])

  function alternarFiltroHoy() {
    setFiltroHoy(v => !v)
  }

  function abrirNuevo() {
    setFormWo('')
    setFormCliente('')
    setFormId('')
    setFormSerie('')
    setFormModelo('')
    setFormNombreEquipo('')
    setFormFecha('')
    setErrorForm(null)
    setGuardando(false)
    setNuevoAbierto(true)
  }

  async function guardarManual() {
    const wo = formWo.trim()
    const fecha = formFecha
    if (!wo) {
      setErrorForm('La WO es obligatoria.')
      return
    }
    if (!fecha) {
      setErrorForm('La fecha es obligatoria (distingue repeticiones de la misma WO).')
      return
    }
    if (!userId) return
    if (!legajoUsuario) {
      setErrorForm('Tu perfil no tiene legajo. Pide al administrador que te lo asigne.')
      return
    }

    setGuardando(true)
    setErrorForm(null)
    try {
      const payload = {
        user_id: userId,
        wo,
        fecha,
        cliente: formCliente.trim(),
        codigo_equipo: formId.trim(),
        serie: formSerie.trim(),
        modelo: formModelo.trim(),
        nombre_equipo: formNombreEquipo.trim(),
        legajo: legajoUsuario,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('workorders')
        .upsert(payload, { onConflict: 'user_id,wo,fecha' })
        .select('*')
        .single()

      if (error) throw error

      setWos(prev => {
        const resto = prev.filter(w => !(w.wo === data.wo && w.fecha === data.fecha))
        return [data, ...resto].sort((a, b) =>
          String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
          String(a.wo || '').localeCompare(String(b.wo || ''))
        )
      })

      const local = wosADexie(data)
      const existe = await db.workorders.filter(w => w.idRemoto === data.id).count()
      if (existe) {
        await db.workorders.filter(w => w.idRemoto === data.id).modify(local)
      } else {
        await db.workorders.add(local)
      }

      setNuevoAbierto(false)
      setMensaje({ color: 'success', texto: `WO ${data.wo} guardada.` })
    } catch (e) {
      if (e.code === '23505') {
        setErrorForm('Ya existe esta WO con la misma fecha.')
      } else {
        setErrorForm(e.message || 'No se pudo guardar.')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarWo() {
    if (!eliminando) return
    setEliminandoConfirmado(true)
    try {
      const { error } = await supabase
        .from('workorders')
        .delete()
        .eq('id', eliminando.id)

      if (error) throw error

      setWos(prev => prev.filter(w => w.id !== eliminando.id))

      try {
        await db.workorders.filter(w => w.idRemoto === eliminando.id).delete()
      } catch { /* silent */ }

      setMensaje({ color: 'success', texto: 'WO eliminada.' })
      setEliminando(null)
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudo eliminar.' })
    } finally {
      setEliminandoConfirmado(false)
    }
  }

  return (
    <AppShell title="Wo's">
      {mensaje && (
        <HeroAlert
          color={mensaje.color}
          title="Wo's"
          description={mensaje.texto}
          onClose={() => setMensaje(null)}
          className="mb-3"
        />
      )}

      {!legajoUsuario && (
        <HeroAlert
          color="warning"
          title="Sin legajo asignado"
          description="Tu perfil no tiene legajo todavía. Pide al administrador que lo asigne para importar o crear WOs."
          className="mb-3"
        />
      )}

      {wosAntiguas.length > 0 && !limpiezaPospuesta && (
        <HeroAlert
          color="warning"
          title="WOs antiguas"
          description={`Tienes ${wosAntiguas.length} WO${wosAntiguas.length === 1 ? '' : 's'} importada${wosAntiguas.length === 1 ? '' : 's'} hace más de ${MESES_RETENCION} meses.`}
          className="mb-3"
          endContent={
            <div className="flex gap-1">
              <Button size="sm" variant="light" onPress={posponerLimpieza}>Más tarde</Button>
              <Button size="sm" color="warning" variant="flat" onPress={() => setLimpiezaAbierta(true)}>Revisar</Button>
            </div>
          }
        />
      )}

      <div className="sticky top-0 z-20 -mx-4 bg-md-light-surface px-6 pb-2 pt-1 dark:bg-md-dark-surface">
        <div className="flex items-center gap-1.5 pb-1">
          {seleccion && (
            <Chip
              className="shrink-0 cursor-pointer bg-primary text-white"
              onClick={() => setSeleccion(null)}
            >
              {seleccion.wo} ✕
            </Chip>
          )}
          {hayFiltros(filtrosBusqueda) && (
            <Chip
              className="min-w-0 cursor-pointer bg-primary text-white"
              onClick={() => setFiltrosBusqueda(null)}
            >
              {resumenFiltros(filtrosBusqueda, nombres, wos)} ✕
            </Chip>
          )}
          <span className="ml-auto shrink-0 text-xs text-gray-500">{wosFiltradas.length} resultados</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Switch size="sm" isSelected={soloMios} onValueChange={setSoloMios}>
            Asignados a mí
          </Switch>
          <Switch size="sm" isSelected={filtroHoy} onValueChange={alternarFiltroHoy}>
            Work orders de hoy
          </Switch>
        </div>
      </div>

      {cargando ? (
        <WosSkeleton filas={6} className="pt-3" />
      ) : wosPagina.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {seleccion || filtroHoy || soloMios || hayFiltros(filtrosBusqueda)
            ? 'Sin WOs para este filtro.'
            : 'No hay workorders. Toca + para importar un Excel o crear una.'}
        </p>
      ) : (
        <div>
          {wosPagina.map(wo => (
            <WoCard
              key={wo.id}
              wo={wo}
              estadoFecha={fechaEstado(wo.fecha)}
              tecnico={nombreDeWo(wo, nombres)}
              onClick={() => setDetalle(wo)}
            />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex justify-center pt-3">
          <Pagination
            total={totalPaginas}
            page={paginaSegura}
            onChange={setPagina}
            size="sm"
            showControls
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">Por página</span>
        <Select
          className="w-24"
          aria-label="Resultados por página"
          selectedKeys={[String(tamanoPagina)]}
          onSelectionChange={keys => setTamanoPagina(Number(Array.from(keys)[0]))}
        >
          <SelectItem key="10">10</SelectItem>
          <SelectItem key="20">20</SelectItem>
        </Select>
      </div>

      {fabAbierto && (
        <div className="fixed inset-0 z-20" onClick={() => setFabAbierto(false)} aria-hidden="true" />
      )}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-3">
        {fabAbierto && (
          <>
            <button
              type="button"
              onClick={() => { setFabAbierto(false); setBuscarAbierto(true) }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-lg dark:bg-gray-800 dark:text-white"
            >
              <Search size={18} /> Buscar WO
            </button>
            <button
              type="button"
              onClick={() => { setFabAbierto(false); setImportarAbierto(true) }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-lg dark:bg-gray-800 dark:text-white"
            >
              <FileSpreadsheet size={18} /> Importar Excel
            </button>
            <button
              type="button"
              onClick={() => { setFabAbierto(false); abrirNuevo() }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-lg dark:bg-gray-800 dark:text-white"
            >
              <FilePlus2 size={18} /> Nueva WO
            </button>
          </>
        )}
        <Fab
          onClick={() => setFabAbierto(v => !v)}
          aria-label={fabAbierto ? 'Cerrar acciones' : 'Abrir acciones'}
          icon={<Plus size={24} className={`transition-transform ${fabAbierto ? 'rotate-45' : ''}`} />}
        />
      </div>

      <BuscarWoModal
        isOpen={buscarAbierto}
        onClose={() => setBuscarAbierto(false)}
        nombres={nombres}
        filtrosIniciales={filtrosBusqueda}
        onSeleccionar={item => {
          setSeleccion(item)
          setFiltrosBusqueda(null)
          setFiltroHoy(false)
          setSoloMios(false)
        }}
        onAplicar={filtros => {
          setSeleccion(null)
          setFiltroHoy(false)
          setSoloMios(false)
          setFiltrosBusqueda(filtros)
        }}
      />

      <ImportarWosExcel
        isOpen={importarAbierto}
        onClose={() => setImportarAbierto(false)}
        userId={userId}
        onImportado={cargar}
      />

      {/* Sheet: detalle + acciones */}
      <Sheet opened={Boolean(detalle)} onBackdropClick={() => setDetalle(null)}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20" />
        <div className="max-h-[70vh] overflow-y-auto px-5 pb-6">
          <div className="mb-3">
            <p className="text-lg font-semibold text-gray-900">{detalle?.wo}</p>
            <p className="text-xs text-gray-500">
              {formatearFecha(detalle?.fecha)}
              {detalle?.tipo_pm ? ` · ${detalle.tipo_pm}` : ''}
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {detalle && CAMPOS_DETALLE.map(([etiqueta, campo]) => {
              const valor = campo === '__fecha' ? formatearFecha(detalle?.fecha) : campo === 'mes' ? formatMes(detalle?.mes) : detalle?.[campo]
              if (!valor) return null
              return (
                <div key={campo}>
                  <dt className="text-xs text-gray-400">{etiqueta}</dt>
                  <dd className="text-sm text-gray-900">{valor}</dd>
                </div>
              )
            })}
          </dl>
          <div className="mt-5 flex gap-2">
            <KonstaButton
              className="w-full bg-red-500 text-white"
              onClick={() => { setEliminando(detalle); setDetalle(null) }}
            >
              Eliminar
            </KonstaButton>
            <KonstaButton
              className="border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-transparent"
              onClick={() => setDetalle(null)}
            >
              Cerrar
            </KonstaButton>
          </div>
        </div>
      </Sheet>

      {/* Modal: nueva WO manual (mínimo) */}
      <Modal isOpen={nuevoAbierto} onOpenChange={setNuevoAbierto} placement="center" size="md">
        <ModalContent>
          <ModalHeader>Nueva WO (manual)</ModalHeader>
          <ModalBody className="gap-3">
            <Input
              label="WO"
              placeholder="Ej. WO12345"
              value={formWo}
              onValueChange={setFormWo}
              isRequired
            />
            <Select
              label="Cliente"
              selectedKeys={formCliente ? [formCliente] : []}
              onSelectionChange={keys => setFormCliente(Array.from(keys)[0] || '')}
              aria-label="Cliente"
            >
              {opcionesCliente.map(cliente => (
                <SelectItem key={cliente}>{cliente}</SelectItem>
              ))}
            </Select>
            <Input
              label="ID"
              placeholder="Ej. C000213"
              value={formId}
              onValueChange={setFormId}
            />
            <Input label="N° de Serie" value={formSerie} onValueChange={setFormSerie} />
            <Select
              label="Modelo"
              selectedKeys={formModelo ? [formModelo] : []}
              onSelectionChange={keys => setFormModelo(Array.from(keys)[0] || '')}
              aria-label="Modelo"
            >
              {MODELOS_MANUALES.map(modelo => (
                <SelectItem key={modelo}>{modelo}</SelectItem>
              ))}
            </Select>
            <Input
              label="Nombre de Agencia"
              value={formNombreEquipo}
              onValueChange={setFormNombreEquipo}
            />
            <Input
              label="Fecha"
              type="date"
              value={formFecha}
              onValueChange={setFormFecha}
              isRequired
            />
            <p className="text-xs text-default-400">
              Legajo asociado: <strong>{legajoUsuario || 'sin asignar'}</strong>. El resto de los datos se completa en una edición futura.
            </p>
            {errorForm && (
              <HeroAlert color="danger" title="No se pudo guardar" description={errorForm} />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setNuevoAbierto(false)} startContent={<X size={16} />}>
              Cancelar
            </Button>
            <Button color="primary" onPress={guardarManual} isLoading={guardando} startContent={<Check size={16} />}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: limpieza de WOs antiguas */}
      <Modal isOpen={limpiezaAbierta} onOpenChange={setLimpiezaAbierta} placement="center" size="sm" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Eliminar WOs antiguas</ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Se eliminarán <strong>{wosAntiguas.length}</strong> WO{wosAntiguas.length === 1 ? '' : 's'} propia{wosAntiguas.length === 1 ? '' : 's'} importada{wosAntiguas.length === 1 ? '' : 's'} hace más de {MESES_RETENCION} meses. No se puede deshacer.
            </p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-default-500">
              {wosAntiguas.slice(0, 50).map(w => (
                <li key={w.id}>{w.wo} · {formatearFecha(w.fecha)}</li>
              ))}
              {wosAntiguas.length > 50 && <li>… y {wosAntiguas.length - 50} más</li>}
            </ul>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setLimpiezaAbierta(false)}>Cancelar</Button>
            <Button color="danger" onPress={eliminarAntiguas} isLoading={limpiando}>Eliminar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: eliminar */}
      <Modal isOpen={Boolean(eliminando)} onOpenChange={() => setEliminando(null)} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>Eliminar WO</ModalHeader>
          <ModalBody>
            <p className="text-sm">
              ¿Eliminar la WO <strong>{eliminando?.wo}</strong> del {formatearFecha(eliminando?.fecha)}?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEliminando(null)}>
              Cancelar
            </Button>
            <Button color="danger" onPress={eliminarWo} isLoading={eliminandoConfirmado}>
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AppShell>
  )
}

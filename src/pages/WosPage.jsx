import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { formatearFecha } from '../lib/date'
import { LEGAJO_ACTUAL } from '../lib/wosConfig'
import ImportarWosExcel from '../components/ImportarWosExcel'
import AppShell from '../components/AppShell'
import {
  Searchbar, List, ListItem, Card, Chip, Fab, Sheet, Button as KonstaButton,
} from 'konsta/react'
import {
  Input, Button, Select, SelectItem, Pagination,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import { Plus, X, Check } from 'lucide-react'

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

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

const CAMPOS_BUSQUEDA = [
  ['todos', 'Todos'],
  ['wo', 'WO'],
  ['id', 'ID'],
  ['distrito', 'Distrito'],
  ['serie', 'Serie'],
]

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

function fechaEstado(fecha) {
  if (!fecha) return null
  const hoy = new Date().toISOString().slice(0, 10)
  if (fecha === hoy) return 'hoy'
  return fecha < hoy ? 'pasado' : 'futuro'
}

const CLASES_ESTADO = {
  hoy: 'bg-amber-100 text-amber-800',
  pasado: 'bg-gray-200 text-gray-600',
  futuro: 'bg-green-100 text-green-800',
}

export default function WosPage() {
  const { session } = useApp()
  const userId = session?.user?.id

  const [wos, setWos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [campoBusqueda, setCampoBusqueda] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)

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
      const { data, error } = await supabase
        .from('workorders')
        .select('*')
        .order('fecha', { ascending: false })
        .order('wo')

      if (error) throw error

      setWos(data || [])

      await db.workorders.clear()
      if (data?.length) {
        await db.workorders.bulkAdd(data.map(mapearADexie))
      }
    } catch {
      try {
        const local = await db.workorders.orderBy('localId').reverse().toArray()
        setWos(local.map(w => ({
          id: w.idRemoto,
          user_id: w.userId,
          anio: w.anio || '',
          mes: w.mes || '',
          cliente: w.cliente || '',
          serie: w.serie || '',
          modelo: w.modelo || '',
          tipo_pm: w.tipoPm || '',
          codigo_equipo: w.codigoEquipo || '',
          nombre_equipo: w.nombreEquipo || '',
          site: w.site || '',
          direccion: w.direccion || '',
          distrito: w.distrito || '',
          provincia: w.provincia || '',
          departamento: w.departamento || '',
          lp: w.lp || '',
          funcion_atm: w.funcionAtm || '',
          horario_pv: w.horarioPv || '',
          restricciones: w.restricciones || '',
          responsable_boveda: w.responsableBoveda || '',
          wo: w.wo || '',
          fecha: w.fecha || '',
          hora: w.hora || '',
          hora_pv: w.horaPv || '',
          legajo: w.legajo || '',
          ce: w.ce || '',
          dni: w.dni || '',
        })))
        setMensaje({ color: 'warning', texto: "Sin conexión. Mostrando las Wo's locales." })
      } catch { /* silent */ }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const wosFiltradas = (() => {
    const tokens = normalizar(busqueda).split(/\s+/).filter(Boolean)
    if (!tokens.length) return wos
    return wos.filter(w => {
      const fuente = {
        todos: [w.wo, w.codigo_equipo, w.distrito, w.serie],
        wo: [w.wo],
        id: [w.codigo_equipo],
        distrito: [w.distrito],
        serie: [w.serie],
      }[campoBusqueda] || [w.wo, w.codigo_equipo, w.distrito, w.serie]
      const campos = fuente.map(normalizar)
      return tokens.every(token => campos.some(campo => campo.includes(token)))
    })
  })()

  const totalPaginas = Math.max(1, Math.ceil(wosFiltradas.length / tamanoPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const wosPagina = wosFiltradas.slice(
    (paginaSegura - 1) * tamanoPagina,
    paginaSegura * tamanoPagina
  )

  useEffect(() => { setPagina(1) }, [busqueda, tamanoPagina])

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
        legajo: LEGAJO_ACTUAL,
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

      const local = mapearADexie(data)
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

      <ImportarWosExcel userId={userId} onImportado={cargar} />

      <div className="sticky top-0 z-20 -mx-4 mt-3 bg-md-light-surface px-6 pb-2 pt-1 dark:bg-md-dark-surface">
        <Searchbar
          value={busqueda}
          onInput={e => setBusqueda(e.target.value)}
          placeholder="Buscar por WO, ID, distrito o serie"
          disableButton
        />
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
          {CAMPOS_BUSQUEDA.map(([valor, etiqueta]) => (
            <Chip
              key={valor}
              className={`shrink-0 cursor-pointer ${campoBusqueda === valor ? 'bg-primary text-white' : ''}`}
              outline={campoBusqueda !== valor}
              onClick={() => setCampoBusqueda(valor)}
            >
              {etiqueta}
            </Chip>
          ))}
          <span className="ml-auto shrink-0 text-xs text-gray-500">{wosFiltradas.length} resultados</span>
        </div>
      </div>

      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-500">Cargando workorders...</p>
      ) : wosPagina.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {busqueda
            ? 'Sin resultados para esa búsqueda.'
            : 'No hay workorders. Importa un Excel o toca + para crear una.'}
        </p>
      ) : (
        <Card>
          <List inset={false}>
            {wosPagina.map(wo => (
              <ListItem
                key={wo.id}
                title={wo.wo || '—'}
                subtitle={[wo.cliente, wo.serie, wo.modelo].filter(Boolean).join(' · ')}
                text={[wo.codigo_equipo, wo.site, wo.distrito].filter(Boolean).join(' · ')}
                after={
                  <div className="flex flex-col items-end gap-1">
                    {wo.fecha && (
                      <Chip className={`px-2 ${CLASES_ESTADO[fechaEstado(wo.fecha)] || ''}`}>
                        {formatearFecha(wo.fecha)}
                      </Chip>
                    )}
                    {wo.tipo_pm && <Chip outline className="px-2">{wo.tipo_pm}</Chip>}
                  </div>
                }
                link
                onClick={() => setDetalle(wo)}
              />
            ))}
          </List>
        </Card>
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

      <Fab onClick={abrirNuevo} className="fixed right-4 bottom-4 z-30" aria-label="Nueva WO">
        <Plus size={24} />
      </Fab>

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
              const valor = campo === '__fecha' ? formatearFecha(detalle?.fecha) : detalle?.[campo]
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
              Legajo asociado: <strong>{LEGAJO_ACTUAL}</strong>. El resto de los datos se completa en una edición futura.
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

function mapearADexie(row) {
  return {
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
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/usePermissions'
import { Button, Chip, Spinner, Alert as HeroAlert } from '@heroui/react'
import { Activity, RefreshCw, Users, MousePointerClick, TriangleAlert, Eye, Smartphone, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import EmptyState from '../components/ui/EmptyState'

const RANGOS = [
  { dias: 1, etiqueta: '24 h' },
  { dias: 7, etiqueta: '7 días' },
  { dias: 30, etiqueta: '30 días' },
  { dias: 90, etiqueta: '90 días' },
]

const NOMBRES_RUTA = {
  '/inicio': 'Inicio',
  '/wos': "Wo's",
  '/repuestos': 'Repuestos',
  '/mis-listas': 'Mis listas',
  '/pedidos': 'Pedidos',
  '/almacen': 'Almacén',
  '/admin/usuarios': 'Admin · Usuarios',
  '/admin/monitoreo': 'Admin · Monitoreo',
}
const nombreRuta = r => NOMBRES_RUTA[r] || r || '—'

const fmt = n => Number(n || 0).toLocaleString('es')
function fmtDuracion(ms) {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${s % 60} s`
}
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Kpi({ icono, etiqueta, valor, color = 'text-primary-600', nota }) {
  const Icono = icono
  return (
    <SectionCard padding="sm">
      <div className="flex items-center gap-2 text-xs text-default-500">
        <Icono size={14} className={color} aria-hidden="true" />
        {etiqueta}
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{valor}</p>
      {nota && <p className="text-xs text-default-500">{nota}</p>}
    </SectionCard>
  )
}

// Barra horizontal proporcional al máximo de la lista
function Barra({ valor, max, className = 'bg-primary' }) {
  const pct = max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-default-100" aria-hidden="true">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Bloque({ titulo, descripcion, children }) {
  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
      {descripcion && <p className="mb-3 mt-0.5 text-xs text-default-500">{descripcion}</p>}
      {children}
    </SectionCard>
  )
}

function ListaBarras({ filas, vacio = 'Sin datos en este periodo.' }) {
  if (!filas.length) return <p className="text-sm text-default-500">{vacio}</p>
  const max = Math.max(...filas.map(f => f.valor))
  return (
    <ul className="space-y-3">
      {filas.map(f => (
        <li key={f.clave}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-foreground">{f.titulo}</span>
            <span className="shrink-0 text-sm font-medium text-foreground">{fmt(f.valor)}</span>
          </div>
          <Barra valor={f.valor} max={max} className={f.color} />
          {f.nota && <p className="mt-0.5 text-xs text-default-500">{f.nota}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function AdminMonitoreoPage() {
  const { profile } = useApp()
  const esAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [dias, setDias] = useState(7)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [purgando, setPurgando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('monitoreo_resumen', { p_dias: dias })
    if (err) {
      setError(
        /monitoreo_resumen|eventos_uso|does not exist/i.test(err.message || '')
          ? 'Falta aplicar la migración 20261118_monitoreo_uso.sql en Supabase.'
          : err.message
      )
      setDatos(null)
    } else {
      setDatos(data)
    }
    setCargando(false)
  }, [dias])

  useEffect(() => {
    if (!profile) return
    if (!esAdmin) {
      navigate('/repuestos', { replace: true })
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
  }, [esAdmin, profile, navigate, cargar])

  async function purgar() {
    if (!window.confirm('¿Borrar los eventos con más de 90 días de antigüedad?')) return
    setPurgando(true)
    const { data, error: err } = await supabase.rpc('purgar_eventos_uso', { p_dias: 90 })
    setPurgando(false)
    setMensaje(err
      ? { color: 'danger', texto: err.message }
      : { color: 'success', texto: `Se borraron ${fmt(data)} eventos antiguos.` })
  }

  if (!esAdmin) return null

  const t = datos?.totales
  const porDia = datos?.por_dia || []
  const porHora = datos?.por_hora || []
  const maxDia = Math.max(1, ...porDia.map(d => d.vistas))
  const horas = Array.from({ length: 24 }, (_, h) => porHora.find(x => x.hora === h) || { hora: h, interacciones: 0, usuarios: 0 })
  const maxHora = Math.max(1, ...horas.map(h => h.interacciones))
  const horaPico = horas.reduce((a, b) => (b.interacciones > a.interacciones ? b : a), horas[0])
  const sesionesTotal = (t?.movil || 0) + (t?.escritorio || 0)

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Activity}
        title="Monitoreo de uso"
        subtitle="Qué usan los técnicos, dónde fallan y cuándo hay más tráfico"
        actions={(
          <Button
            size="sm"
            variant="flat"
            radius="lg"
            startContent={<RefreshCw size={14} />}
            onPress={cargar}
            isLoading={cargando}
          >
            Actualizar
          </Button>
        )}
      />

      {mensaje && <HeroAlert color={mensaje.color} title={mensaje.texto} />}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo">
        {RANGOS.map(r => (
          <Button
            key={r.dias}
            size="sm"
            radius="lg"
            variant={dias === r.dias ? 'solid' : 'flat'}
            color={dias === r.dias ? 'primary' : 'default'}
            onPress={() => setDias(r.dias)}
          >
            {r.etiqueta}
          </Button>
        ))}
      </div>

      {error && <HeroAlert color="danger" title="No se pudo cargar el monitoreo" description={error} />}

      {cargando && !datos && (
        <div className="flex justify-center py-10"><Spinner label="Cargando..." /></div>
      )}

      {datos && t && t.eventos === 0 && (
        <EmptyState icon={Activity}>
          Aún no hay datos. Los eventos aparecerán a medida que los usuarios usen la aplicación.
        </EmptyState>
      )}

      {datos && t && t.eventos > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icono={Users} etiqueta="Usuarios activos" valor={fmt(t.usuarios)} nota={`${fmt(t.sesiones)} sesiones`} />
            <Kpi icono={Eye} etiqueta="Páginas vistas" valor={fmt(t.vistas)} />
            <Kpi icono={MousePointerClick} etiqueta="Clics en botones" valor={fmt(t.acciones)} />
            <Kpi
              icono={TriangleAlert}
              etiqueta="Errores"
              valor={fmt(t.errores)}
              color={t.errores ? 'text-danger' : 'text-success'}
              nota={`${fmt(t.api_fallos)} API fallidas · ${fmt(t.api_lentas)} lentas`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque titulo="Páginas más usadas" descripcion="Vistas, usuarios distintos, tiempo medio de permanencia y errores ocurridos ahí">
              <ListaBarras
                filas={(datos.paginas || []).map(p => ({
                  clave: p.nombre,
                  titulo: nombreRuta(p.nombre),
                  valor: p.vistas,
                  nota: `${fmt(p.usuarios)} usuarios · permanencia ${fmtDuracion(p.permanencia_ms)}${p.errores ? ` · ${fmt(p.errores)} errores` : ''}`,
                  color: p.errores ? 'bg-warning' : 'bg-primary',
                }))}
              />
            </Bloque>

            <Bloque titulo="Funcionalidades más usadas" descripcion="Botones y enlaces con más clics (top 20)">
              <ListaBarras
                filas={(datos.acciones || []).map(a => ({
                  clave: `${a.ruta}|${a.nombre}`,
                  titulo: a.nombre,
                  valor: a.total,
                  nota: `${nombreRuta(a.ruta)} · ${fmt(a.usuarios)} usuarios`,
                }))}
              />
            </Bloque>
          </div>

          <Bloque titulo="Errores y dificultades" descripcion="Errores de JavaScript agrupados por mensaje y página; son la señal más clara de dónde se traban los usuarios">
            {(datos.errores || []).length === 0 ? (
              <p className="text-sm text-success-600">Sin errores en este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-default-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Error</th>
                      <th className="py-2 pr-3 font-medium">Página</th>
                      <th className="py-2 pr-3 text-right font-medium">Veces</th>
                      <th className="py-2 pr-3 text-right font-medium">Usuarios</th>
                      <th className="py-2 font-medium">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.errores.map(e => (
                      <tr key={`${e.ruta}|${e.nombre}`} className="border-t border-default-100 align-top">
                        <td className="max-w-xs break-words py-2 pr-3 text-foreground">{e.nombre}</td>
                        <td className="py-2 pr-3 text-default-600">{nombreRuta(e.ruta)}</td>
                        <td className="py-2 pr-3 text-right font-medium text-danger">{fmt(e.total)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(e.usuarios)}</td>
                        <td className="whitespace-nowrap py-2 text-default-600">{fmtFecha(e.ultimo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloque>

          <Bloque titulo="Llamadas al servidor con problemas" descripcion="Solo se registran las fallidas (HTTP ≥ 400 o sin red) y las lentas (≥ 2 s). p95 = tiempo bajo el cual responde el 95 %">
            {(datos.api || []).length === 0 ? (
              <p className="text-sm text-success-600">Sin llamadas fallidas ni lentas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-default-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Recurso</th>
                      <th className="py-2 pr-3 text-right font-medium">Fallidas</th>
                      <th className="py-2 pr-3 text-right font-medium">Lentas</th>
                      <th className="py-2 text-right font-medium">p95</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.api.map(a => (
                      <tr key={a.nombre} className="border-t border-default-100">
                        <td className="py-2 pr-3 font-mono text-xs text-foreground">{a.nombre}</td>
                        <td className="py-2 pr-3 text-right font-medium text-danger">{fmt(a.fallos)}</td>
                        <td className="py-2 pr-3 text-right text-warning-600">{fmt(a.lentas)}</td>
                        <td className="py-2 text-right">{fmtDuracion(a.p95_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloque>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque
              titulo="Tráfico por hora del día"
              descripcion={`Interacciones por hora (hora de Lima). Pico: ${String(horaPico.hora).padStart(2, '0')}:00 con ${fmt(horaPico.interacciones)} interacciones`}
            >
              <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Interacciones por hora del día">
                {horas.map(h => (
                  <div key={h.hora} className="flex h-full flex-1 flex-col justify-end" title={`${h.hora}:00 — ${fmt(h.interacciones)} interacciones, ${fmt(h.usuarios)} usuarios`}>
                    <div className="rounded-t bg-primary" style={{ height: `${Math.max(h.interacciones ? 4 : 0, Math.round((h.interacciones / maxHora) * 100))}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-default-500">
                <span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span>
              </div>
            </Bloque>

            <Bloque titulo="Evolución diaria" descripcion="Páginas vistas y usuarios activos por día">
              <ListaBarras
                filas={porDia.map(d => ({
                  clave: d.dia,
                  titulo: d.dia.split('-').reverse().join('/'),
                  valor: d.vistas,
                  nota: `${fmt(d.usuarios)} usuarios${d.errores ? ` · ${fmt(d.errores)} errores` : ''}`,
                  color: d.vistas === maxDia ? 'bg-primary' : 'bg-primary-300',
                }))}
              />
            </Bloque>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque titulo="Dispositivos" descripcion="Sesiones según el ancho de pantalla">
              <div className="flex flex-wrap items-center gap-2">
                <Chip variant="flat" startContent={<Smartphone size={13} />}>
                  Móvil: {fmt(t.movil)}{sesionesTotal ? ` (${Math.round((t.movil / sesionesTotal) * 100)} %)` : ''}
                </Chip>
                <Chip variant="flat">
                  Escritorio: {fmt(t.escritorio)}{sesionesTotal ? ` (${Math.round((t.escritorio / sesionesTotal) * 100)} %)` : ''}
                </Chip>
              </div>
            </Bloque>

            <Bloque titulo="Usuarios más activos" descripcion="Por cantidad de eventos (top 15)">
              <ul className="space-y-2">
                {(datos.usuarios || []).map(u => (
                  <li key={u.user_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">
                      {u.nombre}{u.contrata ? <span className="text-default-500"> · {u.contrata}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-default-500">
                      {fmt(u.vistas)} vistas · {fmt(u.acciones)} clics{u.errores ? ` · ${fmt(u.errores)} errores` : ''} · {fmtFecha(u.ultimo)}
                    </span>
                  </li>
                ))}
              </ul>
            </Bloque>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="light" color="danger" radius="lg" startContent={<Trash2 size={14} />} onPress={purgar} isLoading={purgando}>
              Borrar eventos de más de 90 días
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

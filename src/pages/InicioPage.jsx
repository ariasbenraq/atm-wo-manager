import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardBody, Chip, Skeleton } from '@heroui/react'
import { ClipboardCheck, Cog, ListChecks, PackageCheck, CalendarDays, CalendarRange, ChevronRight, WifiOff, TriangleAlert, CircleCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { refrescarCacheWos, leerCacheWos } from '../lib/wosCache'
import { cargarResumenRemoto, resumirWos, resumirPartes } from '../lib/resumen'
import { formatearFecha } from '../lib/date'
import { calcularKit } from '../lib/kitMantenimiento'

const FORMATO_DIA = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima',
})

function Tile({ icon, titulo, valor, detalle, tono = 'default', alVer, cargando }) {
  const Icon = icon
  const tonos = {
    default: 'bg-default-100 text-default-600',
    primary: 'bg-primary-50 text-primary-600',
    warning: 'bg-warning-50 text-warning-700',
    success: 'bg-success-50 text-success-700',
    danger: 'bg-danger-50 text-danger-600',
  }
  return (
    <button
      type="button"
      onClick={alVer}
      className="group w-full cursor-pointer rounded-xl border border-default-200 bg-content1 p-4 text-left shadow-sm transition hover:border-default-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-lg p-2 ${tonos[tono]}`}><Icon size={18} /></span>
        <ChevronRight size={16} className="mt-1 text-default-300 group-hover:text-default-500" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-medium text-default-500">{titulo}</p>
      {cargando ? (
        <Skeleton className="mt-1 h-8 w-12 rounded-md" />
      ) : (
        <p className="text-3xl font-bold tabular-nums text-foreground">{valor ?? '—'}</p>
      )}
      <p className="mt-0.5 min-h-4 text-xs text-default-500">{detalle}</p>
    </button>
  )
}

const ESTADO_KIT = {
  ok: { color: 'success', texto: 'Alcanza' },
  cubierto: { color: 'warning', texto: 'Con pedido' },
  falta: { color: 'danger', texto: 'Falta' },
  desconocido: { color: 'default', texto: 'Sin dato' },
}

function PrevisionKit({ kit, cargando, onPedir }) {
  if (cargando || !kit) {
    return <Skeleton className="h-40 rounded-xl" />
  }
  const faltan = kit.partes.filter(p => p.estado === 'falta')
  const cubiertos = kit.partes.filter(p => p.estado === 'cubierto')

  return (
    <Card shadow="sm" className="border border-default-200">
      <CardBody className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Repuestos de la semana</h2>
          <p className="text-xs text-default-500">
            {kit.atms
              ? `${kit.atms} ATM${kit.atms === 1 ? '' : 's'} de modelos 6623, 6627, 6628 o 6612, de hoy al domingo. Cada uno usa 1 filtro y 8 ventosas.`
              : 'No tienes ATMs de modelos 6623, 6627, 6628 o 6612 programados de hoy al domingo.'}
          </p>
        </div>

        {faltan.length > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">No contamos con la cantidad necesaria</p>
              <p className="text-xs">
                {faltan.map(p => `${p.nombre}: faltan ${p.aSolicitar}`).join(' · ')}.
                {' '}Considera solicitarlo en el siguiente pedido.
              </p>
              <button type="button" onClick={onPedir} className="mt-1.5 cursor-pointer text-xs font-semibold underline">
                Ir a Pedidos
              </button>
            </div>
          </div>
        )}
        {faltan.length === 0 && cubiertos.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-xs text-warning-800" role="status">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Tu stock no alcanza, pero lo que falta ya está en pedidos por recibir.
          </div>
        )}
        {kit.atms > 0 && faltan.length === 0 && cubiertos.length === 0 && kit.partes.every(p => p.estado === 'ok') && (
          <div className="flex items-center gap-2 text-xs text-success-700" role="status">
            <CircleCheck size={16} aria-hidden="true" /> Tienes stock suficiente para toda la semana.
          </div>
        )}

        <ul className="divide-y divide-default-100">
          {kit.partes.map(p => {
            const e = ESTADO_KIT[p.estado]
            return (
              <li key={p.part_number} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{p.nombre}</p>
                  <p className="font-mono text-xs text-default-500">{p.part_number}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-default-500">
                  <p>Necesitas <strong className="text-sm text-foreground tabular-nums">{p.necesario}</strong></p>
                  <p>
                    Tienes <strong className="tabular-nums">{p.enStock ?? '—'}</strong>
                    {p.porRecibir > 0 && ` · +${p.porRecibir} por recibir`}
                  </p>
                </div>
                <Chip size="sm" variant="flat" color={e.color} className="shrink-0">
                  {p.estado === 'falta' ? `Falta ${p.aSolicitar}` : e.texto}
                </Chip>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

export default function InicioPage() {
  const { session, profile } = useApp()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [wos, setWos] = useState(null)
  const [remoto, setRemoto] = useState(null)
  const [sinConexion, setSinConexion] = useState(false)

  useEffect(() => {
    if (!userId) return
    let activo = true
    ;(async () => {
      try {
        const local = await leerCacheWos()
        if (activo && local.length) setWos(local)
      } catch { /* sin caché */ }
      try {
        const frescas = await refrescarCacheWos()
        if (activo) setWos(frescas)
      } catch {
        if (activo) {
          setSinConexion(true)
          setWos(prev => prev ?? [])
        }
      }
    })()
    cargarResumenRemoto(userId).then(r => {
      if (!activo) return
      setRemoto(r)
      if (r.pedidos === null || r.listas === null) setSinConexion(true)
    })
    return () => { activo = false }
  }, [userId])

  const resumenWos = useMemo(() => (wos ? resumirWos(wos, userId) : null), [wos, userId])
  const partes = useMemo(() => (
    resumenWos && remoto?.pedidos
      ? resumirPartes(remoto.pedidos, resumenWos.propias, resumenWos.hoy, resumenWos.fin)
      : null
  ), [resumenWos, remoto])

  const kit = useMemo(() => (
    resumenWos && remoto
      ? calcularKit(resumenWos.semana, remoto.stock, remoto.entrante)
      : null
  ), [resumenWos, remoto])

  const listas = remoto?.listas
  const partesSinSync = listas ? listas.reduce((s, l) => s + l.partes, 0) : null
  const proxima = resumenWos?.deHoy[0]
  const nombre = (profile?.full_name || '').split(' ')[0]
  const cargandoWos = wos === null
  const cargandoRemoto = remoto === null

  const detallePartes = p => (p ? (p.porRecibir ? `${p.porRecibir} por recibir` : p.total ? 'Todas recibidas' : 'Sin pedidos') : '')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">{nombre ? `Hola, ${nombre}` : 'Inicio'}</h1>
        <p className="text-sm text-default-500 first-letter:uppercase">
          {FORMATO_DIA.format(new Date())}
          {profile?.legajo ? ` · ${profile.legajo}` : ''}
        </p>
      </div>

      {sinConexion && (
        <div className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-800" role="status">
          <WifiOff size={14} /> Sin conexión: algunas cifras no se pudieron actualizar.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          icon={CalendarDays} tono="primary" titulo="WOs de hoy" cargando={cargandoWos}
          valor={resumenWos?.deHoy.length}
          detalle={proxima ? `Próxima: ${proxima.hora || 'sin hora'}` : 'Nada programado'}
          alVer={() => navigate('/wos?filtro=hoy')}
        />
        <Tile
          icon={CalendarRange} titulo="WOs esta semana" cargando={cargandoWos}
          valor={resumenWos?.semana.length}
          detalle="De hoy al domingo"
          alVer={() => navigate('/wos')}
        />
        <Tile
          icon={Cog} tono="primary" titulo="Partes para hoy" cargando={cargandoWos || cargandoRemoto}
          valor={partes?.hoy.total}
          detalle={detallePartes(partes?.hoy)}
          alVer={() => navigate('/pedidos')}
        />
        <Tile
          icon={Cog}
          tono={kit?.hayFalta ? 'danger' : kit?.hayCubierto ? 'warning' : 'default'}
          titulo="Repuestos esta semana" cargando={cargandoWos || cargandoRemoto}
          valor={kit ? kit.partes.reduce((s, p) => s + p.necesario, 0) : undefined}
          detalle={
            !kit ? '' : kit.hayFalta ? 'Falta stock: considera pedir'
              : kit.hayCubierto ? 'Cubierto con pedidos por recibir'
              : kit.atms ? 'Stock suficiente' : 'Sin ATMs con kit'
          }
          alVer={() => navigate('/pedidos')}
        />
        <Tile
          icon={ListChecks} tono={partesSinSync ? 'warning' : 'success'}
          titulo="Partes usadas sin sincronizar" cargando={cargandoRemoto}
          valor={partesSinSync}
          detalle={listas ? (listas.length ? `En ${listas.length} lista${listas.length === 1 ? '' : 's'}` : 'Todo al día') : ''}
          alVer={() => navigate('/mis-listas')}
        />
        <Tile
          icon={PackageCheck} tono={remoto?.pedidosPorRecibir ? 'warning' : 'success'}
          titulo="Pedidos por recibir" cargando={cargandoRemoto}
          valor={remoto?.pedidosPorRecibir}
          detalle={remoto?.pedidosPorRecibir === 0 ? 'Todo recibido' : ''}
          alVer={() => navigate('/pedidos')}
        />
      </div>

      <PrevisionKit kit={kit} cargando={cargandoWos || cargandoRemoto} onPedir={() => navigate('/pedidos')} />

      <Card shadow="sm" className="border border-default-200">
        <CardBody className="p-0">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardCheck size={16} className="text-default-400" /> Agenda de hoy
            </h2>
            <button
              type="button"
              onClick={() => navigate('/wos?filtro=hoy')}
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>
          {cargandoWos ? (
            <div className="space-y-2 px-4 pb-4">
              <Skeleton className="h-10 rounded-lg" /><Skeleton className="h-10 rounded-lg" />
            </div>
          ) : resumenWos.deHoy.length === 0 ? (
            <p className="px-4 pb-5 text-sm text-default-400">No tienes WOs para hoy.</p>
          ) : (
            <ul className="divide-y divide-default-100 pb-1">
              {resumenWos.deHoy.slice(0, 6).map(w => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => navigate('/wos?filtro=hoy')}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-default-50"
                  >
                    <Chip size="sm" variant="flat" color="primary" className="shrink-0 font-mono">{w.hora || '—'}</Chip>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{w.wo}</span>
                      <span className="block truncate text-xs text-default-500">
                        {[w.site || w.nombre_equipo, w.codigo_equipo].filter(Boolean).join(' · ') || formatearFecha(w.fecha)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {resumenWos.deHoy.length > 6 && (
                <li className="px-4 py-2 text-xs text-default-400">… y {resumenWos.deHoy.length - 6} más</li>
              )}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

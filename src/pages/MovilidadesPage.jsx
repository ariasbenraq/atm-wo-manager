import { useState, useEffect, useMemo } from 'react'
import { Button, Input, Select, SelectItem, Chip } from '@heroui/react'
import { Route, ExternalLink, Home, TriangleAlert, WifiOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useLegajo } from '../hooks/useLegajo'
import { useDomicilio } from '../hooks/useDomicilio'
import { useBorradorMovilidad } from '../hooks/useBorradorMovilidad'
import { refrescarCacheWos, leerCacheWos } from '../lib/wosCache'
import { hoyLima } from '../lib/wosTecnicos'
import { armarTramos, faltantesTramo } from '../lib/movilidades'
import { construirUrlMovilidad, legajoParaMovilidad, TRANSPORTES_MOV, STATUS_WO_MOV } from '../lib/googleFormMovilidad'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import EmptyState from '../components/ui/EmptyState'

function TarjetaDomicilio({ domicilio, cargado, onGuardar }) {
  const [distrito, setDistrito] = useState('')
  const [direccion, setDireccion] = useState('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    setDistrito(domicilio.distrito)
    setDireccion(domicilio.direccion)
  }, [domicilio])

  const cambiado = distrito.trim() !== domicilio.distrito || direccion.trim() !== domicilio.direccion
  const completo = distrito.trim() && direccion.trim()

  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center gap-2">
        <Home size={16} className="text-default-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Mi domicilio</h2>
      </div>
      <p className="text-xs text-default-500">
        Es el punto inicial del primer tramo y el destino del retorno. Se guarda en tu cuenta y puedes editarlo cuando quieras.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label="Distrito" placeholder="Jesús María" size="sm" variant="bordered" radius="lg"
          value={distrito} onValueChange={v => { setDistrito(v); setGuardado(false) }} isDisabled={!cargado}
        />
        <Input
          label="Dirección" placeholder="Av. Húsares de Junín 463" size="sm" variant="bordered" radius="lg"
          value={direccion} onValueChange={v => { setDireccion(v); setGuardado(false) }} isDisabled={!cargado}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          color="primary" size="sm" radius="lg" className="min-h-11 sm:min-h-8"
          isDisabled={!completo || !cambiado}
          onPress={async () => { await onGuardar({ distrito, direccion }); setGuardado(true) }}
        >
          Guardar domicilio
        </Button>
        {guardado && <span className="text-xs text-success-700">Guardado</span>}
      </div>
    </SectionCard>
  )
}

function TarjetaTramo({ tramo, numero, valores, informe, onCambiar, urlBase, legajoOk }) {
  const t = { ...tramo, ...valores, informe }
  const faltan = faltantesTramo(t)
  const listo = faltan.length === 0 && legajoOk
  return (
    <SectionCard padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {numero}. {t.origenEtiqueta} → {t.destinoEtiqueta}
        </p>
        <Chip size="sm" variant="flat" color={t.esRetorno ? 'secondary' : 'primary'}>{t.tipoTraslado}</Chip>
      </div>
      <div className="grid gap-1 text-xs text-default-500 sm:grid-cols-2">
        <p><span className="font-medium text-default-600">Partida:</span> {t.origen.direccion || '—'}, {t.origen.distrito || '—'}</p>
        <p><span className="font-medium text-default-600">Llegada:</span> {t.destino.direccion || '—'}, {t.destino.distrito || '—'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Input
          label="Hora inicio" type="time" size="sm" variant="bordered" radius="lg"
          value={t.hora} onValueChange={v => onCambiar({ hora: v })}
        />
        <Input
          label="Costo (S/)" type="number" min="0" inputMode="decimal" size="sm" variant="bordered" radius="lg"
          value={String(t.costo)} onValueChange={v => onCambiar({ costo: v })}
        />
        <Select
          label="Transporte" size="sm" variant="bordered" radius="lg" disallowEmptySelection
          selectedKeys={[t.transporte]}
          onSelectionChange={k => onCambiar({ transporte: Array.from(k)[0] || TRANSPORTES_MOV[0] })}
        >
          {TRANSPORTES_MOV.map(x => <SelectItem key={x}>{x}</SelectItem>)}
        </Select>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <Input
          label="Descripción del servicio" maxLength={60} size="sm" variant="bordered" radius="lg"
          value={t.descripcion} onValueChange={v => onCambiar({ descripcion: v })}
        />
        <Select
          label="Status de la WO" size="sm" variant="bordered" radius="lg" disallowEmptySelection
          selectedKeys={[t.status]}
          onSelectionChange={k => onCambiar({ status: Array.from(k)[0] || STATUS_WO_MOV[2] })}
        >
          {STATUS_WO_MOV.map(x => <SelectItem key={x}>{x}</SelectItem>)}
        </Select>
      </div>
      {faltan.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-warning-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Falta: {faltan.join(', ')}. Puedes abrir el formulario igual y completarlo allí.
        </p>
      )}
      <a
        href={legajoOk ? urlBase(t) : undefined}
        aria-disabled={!legajoOk}
        target="_blank" rel="noopener noreferrer"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${
          legajoOk
            ? `bg-primary text-primary-foreground hover:opacity-90 ${listo ? '' : 'opacity-90'}`
            : 'cursor-not-allowed bg-default-100 text-default-400'
        }`}
      >
        <ExternalLink size={16} aria-hidden="true" />
        Abrir formulario
      </a>
    </SectionCard>
  )
}

export default function MovilidadesPage() {
  const { session, profile } = useApp()
  const userId = session?.user?.id
  const legajo = useLegajo()
  const { domicilio, guardar, cargado } = useDomicilio()
  const email = profile?.email || session?.user?.email || ''

  const [fecha, setFecha] = useState(hoyLima())
  const [wos, setWos] = useState(null)
  const [sinConexion, setSinConexion] = useState(false)
  const { ediciones, informes, cargado: borradorListo, guardando, cambiarTramo, cambiarInforme } = useBorradorMovilidad()

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
    return () => { activo = false }
  }, [userId])

  const { tramos, wosDelDia } = useMemo(
    () => armarTramos({ wos: wos || [], legajo, fecha, domicilio }),
    [wos, legajo, fecha, domicilio],
  )
  const legajoForm = legajoParaMovilidad(legajo)
  const urlTramo = t => construirUrlMovilidad({ tramo: t, email, legajo: legajoForm })

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader
        icon={Route}
        title="Movilidades"
        subtitle="Tramos del día con el formulario de gastos de movilidad ya prellenado."
      />

      {sinConexion && (
        <p className="flex items-center gap-1.5 text-xs text-default-500">
          <WifiOff size={14} aria-hidden="true" /> Sin conexión: se usan las WOs guardadas en este dispositivo.
        </p>
      )}

      {!legajo ? (
        <EmptyState icon={TriangleAlert}>
          Tu cuenta no tiene legajo asignado. Pide a un administrador que lo configure para ver tus WOs.
        </EmptyState>
      ) : (
        <>
          {!legajoForm && (
            <p className="flex items-start gap-1.5 text-xs text-warning-700">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Tu legajo «{legajo}» no está en la lista del formulario de movilidades; no se puede prellenar el enlace.
            </p>
          )}

          <TarjetaDomicilio domicilio={domicilio} cargado={cargado} onGuardar={guardar} />

          <SectionCard className="flex flex-wrap items-end gap-3">
            <Input
              label="Fecha" type="date" size="sm" variant="bordered" radius="lg" className="max-w-48"
              value={fecha} onValueChange={v => v && setFecha(v)}
            />
            <p className="pb-2 text-sm text-default-500">
              {wos === null ? 'Cargando…' : `${wosDelDia.length} WO${wosDelDia.length === 1 ? '' : 's'} asignada${wosDelDia.length === 1 ? '' : 's'} a ${legajo}`}
            </p>
          </SectionCard>

          {wosDelDia.length > 0 && (
            <SectionCard className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">N° de informe por WO</h2>
                <span className="text-xs text-default-500" aria-live="polite">
                  {!borradorListo ? 'Cargando…' : guardando ? 'Guardando…' : 'Se guarda solo'}
                </span>
              </div>
              <p className="text-xs text-default-500">
                Puedes llenarlos durante el día o al final; quedan guardados y se usan en el ida y en el retorno de cada WO. Si no existe, escribe 000000.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {wosDelDia.map(w => (
                  <Input
                    key={w.wo}
                    label={`Informe de ${w.wo}`} placeholder="000000" maxLength={7} inputMode="numeric"
                    size="sm" variant="bordered" radius="lg"
                    value={informes[w.wo]?.informe || ''}
                    onValueChange={v => cambiarInforme(w.wo, v, fecha)}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {wos !== null && tramos.length === 0 ? (
            <EmptyState icon={Route}>No tienes WOs asignadas para esta fecha.</EmptyState>
          ) : (
            <div className="space-y-3">
              {tramos.map((t, i) => (
                <TarjetaTramo
                  key={t.clave}
                  tramo={t}
                  numero={i + 1}
                  valores={ediciones[t.clave]}
                  informe={informes[t.wo]?.informe || ''}
                  onCambiar={cambio => cambiarTramo(t.clave, cambio)}
                  urlBase={urlTramo}
                  legajoOk={!!legajoForm}
                />
              ))}
              {tramos.length > 0 && (
                <p className="text-xs text-default-500">
                  El formulario no se envía solo: revísalo, adjunta las fotos del GPS y del costo del taxi, y pulsa «Enviar» allí.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Select, SelectItem, Autocomplete, AutocompleteItem, Button, Chip, Alert as HeroAlert,
} from '@heroui/react'
import { ExternalLink, Check, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { hoyLima } from '../lib/wosTecnicos'
import {
  CLIENTES_FORM, LEGAJOS_FORM, ZONA_FORM, MAX_REPUESTOS_POR_ENVIO,
  clienteParaForm, legajoParaForm, dividirEnEnvios, construirUrlFormulario,
} from '../lib/googleForm'

const FORMATO_FECHA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' })

function fechaLima(iso) {
  return iso ? FORMATO_FECHA_LIMA.format(new Date(iso)) : hoyLima()
}

export default function EnviarFormularioModal({ isOpen, onClose, lista, items, legajo, email: emailRegistrado, onEstadoCambiado, onPresupuestoGuardado }) {
  const [wo, setWo] = useState('')
  const [legajoSel, setLegajoSel] = useState('')
  const [correo, setCorreo] = useState('')
  const [cliente, setCliente] = useState('')
  const [clienteAuto, setClienteAuto] = useState(false)
  const [fecha, setFecha] = useState('')
  const [presupuestos, setPresupuestos] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen || !lista) return
    const woLista = String(lista.work_order || lista.workOrder || '').trim()
    setWo(woLista)
    setLegajoSel(legajoParaForm(legajo))
    setCorreo(String(emailRegistrado || '').trim())
    setFecha(fechaLima(lista.inventory_synced_at))
    setPresupuestos(Object.fromEntries(items.map(i => [i.id, i.presupuesto || ''])))
    setError(null)
    setCliente('')
    setClienteAuto(false)
    if (woLista) {
      db.workorders.filter(w => w.wo === woLista).first().then(w => {
        const c = clienteParaForm(w?.cliente)
        if (c) { setCliente(c); setClienteAuto(true) }
      }).catch(() => {})
    }
    // Se inicializa solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const envios = useMemo(() => dividirEnEnvios(
    items.map(i => ({
      id: i.id,
      partNumber: i.repuesto?.part_number || '',
      cantidad: i.quantity ?? 1,
      presupuesto: (presupuestos[i.id] || '').trim(),
    }))
  ), [items, presupuestos])

  const sinPartNumber = items.some(i => !i.repuesto?.part_number)
  const woLimpia = wo.trim().toUpperCase()
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
  const listo = Boolean(woLimpia && legajoSel && correoValido && cliente && fecha && !sinPartNumber)

  function urlEnvio(envio) {
    return construirUrlFormulario({ wo: woLimpia, legajo: legajoSel, email: correo.trim(), cliente, fecha, items: envio })
  }

  // Guarda los presupuestos escritos (si la columna existe); no bloquea la apertura del formulario
  async function guardarPresupuestos() {
    for (const i of items) {
      const nuevo = (presupuestos[i.id] || '').trim()
      if ((i.presupuesto || '') === nuevo) continue
      const { error: err } = await supabase
        .from('spare_part_list_items')
        .update({ presupuesto: nuevo })
        .eq('id', i.id)
      if (err) return
      onPresupuestoGuardado?.(i.id, nuevo)
    }
  }

  async function cambiarMarca(enviada) {
    setGuardando(true)
    setError(null)
    try {
      await guardarPresupuestos()
      const valor = enviada ? new Date().toISOString() : null
      const { error: err } = await supabase
        .from('spare_part_lists')
        .update({ form_enviado_en: valor })
        .eq('id', lista.id)
      if (err) {
        throw new Error(
          err.code === '42703' || /form_enviado_en/.test(err.message || '')
            ? 'Falta aplicar la migración 20261103 en Supabase.'
            : err.message
        )
      }
      onEstadoCambiado(valor)
      if (enviada) onClose()
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado.')
    } finally {
      setGuardando(false)
    }
  }

  const enviadaEn = lista?.form_enviado_en

  return (
    <Modal isOpen={isOpen} onOpenChange={abierto => !abierto && onClose()} placement="center" size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Enviar al formulario de consumo</ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-xs text-default-500">
            Se abre el Google Form con los datos ya escritos. Revísalos y pulsa «Enviar» allí.
          </p>

          <Input
            label="WorkOrder" placeholder="W23456789" value={wo} onValueChange={setWo}
            variant="bordered" radius="lg" size="sm" isRequired
            isInvalid={!woLimpia} errorMessage={!woLimpia ? 'Indica la WO de esta lista.' : undefined}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Cliente" size="sm" variant="bordered" radius="lg" isRequired
              selectedKeys={cliente ? [cliente] : []}
              onSelectionChange={k => { setCliente(Array.from(k)[0] || ''); setClienteAuto(false) }}
              description={clienteAuto ? 'Tomado de la WO' : undefined}
            >
              {CLIENTES_FORM.map(c => <SelectItem key={c}>{c}</SelectItem>)}
            </Select>
            <Input
              label="Fecha de consumo" type="date" value={fecha} onValueChange={setFecha}
              variant="bordered" radius="lg" size="sm" isRequired
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Autocomplete
              label="Legajo" size="sm" variant="bordered" radius="lg" isRequired
              defaultItems={LEGAJOS_FORM.map(l => ({ key: l }))}
              selectedKey={legajoSel || null}
              onSelectionChange={k => setLegajoSel(k ? String(k) : '')}
              description={legajoSel && legajoSel === legajoParaForm(legajo) ? 'Tomado de tu perfil' : undefined}
              errorMessage={!legajoSel ? (legajo ? `«${legajo}» no está en el formulario: elige uno.` : 'Elige un legajo.') : undefined}
              isInvalid={!legajoSel}
            >
              {o => <AutocompleteItem key={o.key}>{o.key}</AutocompleteItem>}
            </Autocomplete>
            <Input
              label="Correo" type="email" size="sm" variant="bordered" radius="lg" isRequired
              value={correo} onValueChange={setCorreo}
              description={correoValido && correo.trim() === String(emailRegistrado || '').trim() ? 'Tomado de tu registro' : undefined}
              isInvalid={!correoValido}
              errorMessage={!correoValido ? 'Escribe un correo válido.' : undefined}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-default-500">
            <span>Zona:</span>
            <Chip size="sm" variant="flat">{ZONA_FORM}</Chip>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-default-600">Repuestos ({items.length})</p>
            <ul className="divide-y divide-default-100 rounded-lg border border-default-200">
              {items.map(i => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{i.repuesto?.part_number || '—'}</p>
                    <p className="truncate text-xs text-default-500">{i.repuesto?.nombre || ''} · {i.quantity ?? 1} u.</p>
                  </div>
                  <Input
                    aria-label={`N° de presupuesto de ${i.repuesto?.part_number}`} placeholder="N° presupuesto"
                    size="sm" variant="bordered" radius="lg" className="w-36 shrink-0"
                    value={presupuestos[i.id] || ''}
                    onValueChange={v => setPresupuestos(prev => ({ ...prev, [i.id]: v }))}
                  />
                </li>
              ))}
            </ul>
            {sinPartNumber && <p className="mt-1 text-xs text-danger">Hay repuestos sin part number; corrígelos antes de enviar.</p>}
          </div>

          {envios.length > 1 && (
            <HeroAlert
              color="warning" title={`${envios.length} envíos`}
              description={`El formulario admite hasta ${MAX_REPUESTOS_POR_ENVIO} repuestos por envío. Abre y envía cada uno por separado.`}
            />
          )}

          <div className="space-y-2">
            {listo ? envios.map((envio, idx) => (
              <a
                key={idx}
                href={urlEnvio(envio)}
                target="_blank" rel="noopener noreferrer"
                onClick={() => { guardarPresupuestos() }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <ExternalLink size={16} aria-hidden="true" />
                {envios.length > 1 ? `Abrir formulario (${idx + 1} de ${envios.length}) · ${envio.length} repuesto${envio.length === 1 ? '' : 's'}` : 'Abrir formulario'}
              </a>
            )) : (
              <p className="text-xs text-default-400">Completa WO, legajo, correo, cliente y fecha para generar el enlace.</p>
            )}
          </div>

          {enviadaEn && (
            <p className="text-xs text-success-700">
              Marcada como enviada el {new Date(enviadaEn).toLocaleDateString('es-PE')}.
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cerrar</Button>
          {enviadaEn ? (
            <Button variant="flat" onPress={() => cambiarMarca(false)} isLoading={guardando} startContent={<Undo2 size={16} />}>
              Quitar marca de enviada
            </Button>
          ) : (
            <Button color="success" variant="flat" onPress={() => cambiarMarca(true)} isLoading={guardando} startContent={<Check size={16} />}>
              Ya lo envié
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

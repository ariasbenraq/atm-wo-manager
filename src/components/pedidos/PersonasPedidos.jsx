import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import {
  Card, CardBody, CardHeader, Divider,
  Input, Button, Chip, Select, SelectItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Alert as HeroAlert,
} from '@heroui/react'
import { Users, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const TIPOS = [
  { valor: 'recepcion', etiqueta: 'Recepción (llamada/pedido)' },
  { valor: 'entrega', etiqueta: 'Entrega (motorizado)' },
]

function etiquetaTipo(tipo) {
  return TIPOS.find(t => t.valor === tipo)?.etiqueta || tipo
}

export default function PersonasPedidos() {
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formNombre, setFormNombre] = useState('')
  const [formTipo, setFormTipo] = useState('recepcion')
  const [errorNombre, setErrorNombre] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [eliminando, setEliminando] = useState(null)
  const [eliminandoConfirmado, setEliminandoConfirmado] = useState(false)

  async function cargar() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('pedidos_personas')
        .select('*')
        .order('tipo')
        .order('nombre')

      if (error) throw error

      setPersonas(data || [])

      await db.pedidosPersonas.clear()
      if (data?.length) {
        await db.pedidosPersonas.bulkAdd(data.map(p => ({
          idRemoto: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          creadoEn: p.created_at,
        })))
      }
    } catch {
      const local = await db.pedidosPersonas.toArray()
      setPersonas(local.map(p => ({
        id: p.idRemoto,
        nombre: p.nombre,
        tipo: p.tipo,
      })))
      setMensaje({ color: 'warning', texto: 'Sin conexión. Mostrando el listado local.' })
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setEditando(null)
    setFormNombre('')
    setFormTipo('recepcion')
    setErrorNombre(null)
    setModalAbierto(true)
  }

  function abrirEdicion(persona) {
    setEditando(persona)
    setFormNombre(persona.nombre || '')
    setFormTipo(persona.tipo || 'recepcion')
    setErrorNombre(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setGuardando(false)
  }

  async function guardar() {
    const nombreLimpio = formNombre.trim()
    if (!nombreLimpio) {
      setErrorNombre('El nombre es obligatorio.')
      return
    }

    const duplicado = personas.some(p =>
      p.nombre.toLowerCase() === nombreLimpio.toLowerCase() &&
      p.tipo === formTipo &&
      p.id !== editando?.id
    )
    if (duplicado) {
      setErrorNombre('Ya existe una persona con ese nombre para ese tipo.')
      return
    }

    setGuardando(true)
    try {
      if (editando) {
        const { error } = await supabase
          .from('pedidos_personas')
          .update({ nombre: nombreLimpio, tipo: formTipo })
          .eq('id', editando.id)

        if (error) throw error

        setPersonas(prev => prev.map(p => p.id === editando.id
          ? { ...p, nombre: nombreLimpio, tipo: formTipo }
          : p
        ))

        await db.pedidosPersonas.filter(p => p.idRemoto === editando.id).modify({
          nombre: nombreLimpio,
          tipo: formTipo,
        })

        setMensaje({ color: 'success', texto: 'Persona actualizada.' })
      } else {
        const { data, error } = await supabase
          .from('pedidos_personas')
          .insert({ nombre: nombreLimpio, tipo: formTipo })
          .select('*')
          .single()

        if (error) throw error

        setPersonas(prev => [...prev, data].sort((a, b) =>
          a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre)
        ))

        await db.pedidosPersonas.add({
          idRemoto: data.id,
          nombre: data.nombre,
          tipo: data.tipo,
          creadoEn: data.created_at,
        })

        setMensaje({ color: 'success', texto: 'Persona agregada.' })
      }

      cerrarModal()
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudo guardar la persona.' })
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!eliminando) return
    setEliminandoConfirmado(true)
    try {
      const { error } = await supabase
        .from('pedidos_personas')
        .delete()
        .eq('id', eliminando.id)

      if (error) throw error

      setPersonas(prev => prev.filter(p => p.id !== eliminando.id))

      try {
        await db.pedidosPersonas.filter(p => p.idRemoto === eliminando.id).delete()
      } catch { /* silent */ }

      setMensaje({ color: 'success', texto: 'Persona eliminada.' })
      setEliminando(null)
    } catch (e) {
      setMensaje({ color: 'danger', texto: e.message || 'No se pudo eliminar la persona.' })
    } finally {
      setEliminandoConfirmado(false)
    }
  }

  const recepcion = personas.filter(p => p.tipo === 'recepcion')
  const entrega = personas.filter(p => p.tipo === 'entrega')

  function renderGrupo(titulo, lista) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-default-400 mb-1.5">{titulo}</p>
        {lista.length === 0 ? (
          <p className="text-sm text-default-400">Sin personas registradas.</p>
        ) : (
          <ul className="divide-y divide-default-100">
            {lista.map(persona => (
              <li key={persona.id} className="flex items-center justify-between gap-3 py-2">
                <p className="text-sm text-default-900 min-w-0 truncate">{persona.nombre}</p>
                <div className="flex shrink-0 gap-1">
                  <Button isIconOnly size="sm" variant="light" aria-label="Editar persona" onPress={() => abrirEdicion(persona)}>
                    <Pencil size={15} />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Eliminar persona" onPress={() => setEliminando(persona)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <Card shadow="sm">
      <CardHeader className="flex items-center justify-between gap-3 pb-0">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-default-400" />
          <p className="text-sm font-semibold">Personas de pedidos</p>
          <span className="text-xs text-default-400">({personas.length})</span>
        </div>
        <Button size="sm" color="primary" variant="flat" startContent={<Plus size={16} />} onPress={abrirNuevo}>
          Nueva persona
        </Button>
      </CardHeader>
      <Divider className="mt-3" />
      <CardBody className="gap-4">
        {mensaje && (
          <HeroAlert
            color={mensaje.color}
            title="Personas de pedidos"
            description={mensaje.texto}
            onClose={() => setMensaje(null)}
          />
        )}

        {cargando ? (
          <p className="text-sm text-default-400 py-4 text-center">Cargando personas...</p>
        ) : (
          <div className="space-y-5">
            {renderGrupo('Recepción (quién recibe la llamada/pedido)', recepcion)}
            {renderGrupo('Entrega (motorizado)', entrega)}
          </div>
        )}
      </CardBody>

      <Modal isOpen={modalAbierto} onOpenChange={cerrarModal} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>{editando ? 'Editar persona' : 'Nueva persona'}</ModalHeader>
          <ModalBody className="gap-3">
            <Input
              label="Nombre"
              placeholder="Nombre completo"
              value={formNombre}
              onValueChange={setFormNombre}
              isInvalid={Boolean(errorNombre)}
              errorMessage={errorNombre}
              isRequired
            />
            <Select
              label="Tipo"
              selectedKeys={[formTipo]}
              onSelectionChange={keys => setFormTipo(Array.from(keys)[0])}
            >
              {TIPOS.map(t => <SelectItem key={t.valor}>{t.etiqueta}</SelectItem>)}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={cerrarModal} startContent={<X size={16} />}>
              Cancelar
            </Button>
            <Button color="primary" onPress={guardar} isLoading={guardando} startContent={<Check size={16} />}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(eliminando)} onOpenChange={() => setEliminando(null)} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>Eliminar persona</ModalHeader>
          <ModalBody>
            <p className="text-sm">
              ¿Eliminar a <strong>{eliminando?.nombre}</strong> ({etiquetaTipo(eliminando?.tipo)})? Los pedidos que ya la registraron conservarán el nombre histórico.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEliminando(null)}>
              Cancelar
            </Button>
            <Button color="danger" onPress={eliminar} isLoading={eliminandoConfirmado}>
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}

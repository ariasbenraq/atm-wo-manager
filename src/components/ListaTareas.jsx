import { useState } from 'react'
import { Card, CardBody, CardHeader, Input, Chip, Divider, ScrollShadow, Button } from '@heroui/react'
import { Search, MapPin, Clock, CalendarDays, Plus, Check, X } from 'lucide-react'

const chipColor = (id) => {
  if (!id) return 'default'
  if (id.startsWith('C')) return 'warning'
  if (id.startsWith('K')) return 'primary'
  return 'default'
}

export default function ListaTareas({ tareas, misTareas = [], onAgregarAMisTareas }) {
  const [busqueda, setBusqueda] = useState('')
  const [fechaBusqueda, setFechaBusqueda] = useState('')

  const hoy = new Date().toISOString().split('T')[0]
  const misTareasWo = new Set(misTareas.map(tarea => tarea.wo))

  const filtradas = tareas.filter(t => {
    const q = busqueda.toLowerCase()
    const coincideTexto = (
      t.wo?.toLowerCase().includes(q) ||
      t.nombre?.toLowerCase().includes(q) ||
      t.ce?.toLowerCase().includes(q) ||
      t.distrito?.toLowerCase().includes(q) ||
      t.id_atm?.toLowerCase().includes(q)
    )
    const coincideFecha = fechaBusqueda ? t.fecha === fechaBusqueda : true

    return (
      coincideTexto && coincideFecha
    )
  })

  if (tareas.length === 0) {
    return (
      <Card shadow="sm">
        <CardBody className="py-10 text-center">
          <p className="text-default-400 text-sm">Sin tareas. Importa un Excel para comenzar.</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card shadow="sm">
      <CardHeader className="flex flex-col gap-3 pb-0">
        <div className="flex justify-between w-full items-center">
          <p className="text-sm font-semibold">Tareas</p>
          <Chip size="sm" variant="flat" color="default">
            {filtradas.length} de {tareas.length}
          </Chip>
        </div>
        <Input
          placeholder="WO, agencia, usuario, distrito, ID..."
          value={busqueda}
          onValueChange={setBusqueda}
          startContent={<Search size={14} className="text-default-400" />}
          size="sm"
          variant="bordered"
          radius="lg"
          classNames={{ inputWrapper: "border-default-200" }}
        />
        <div className="flex gap-2 w-full">
          <Input
            type="date"
            aria-label="Filtrar tareas por fecha"
            value={fechaBusqueda}
            onValueChange={setFechaBusqueda}
            startContent={<CalendarDays size={14} className="text-default-400" />}
            size="sm"
            variant="bordered"
            radius="lg"
            className="flex-1"
            classNames={{ inputWrapper: "border-default-200" }}
          />
          <Button
            size="sm"
            variant="flat"
            color="primary"
            radius="lg"
            onPress={() => setFechaBusqueda(hoy)}
          >
            Hoy
          </Button>
          {fechaBusqueda && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              aria-label="Limpiar filtro de fecha"
              onPress={() => setFechaBusqueda('')}
            >
              <X size={15} />
            </Button>
          )}
        </div>
      </CardHeader>
      <Divider className="mt-3" />
      <CardBody className="p-0">
        <ScrollShadow className="max-h-[60vh]">
          {filtradas.length === 0 ? (
            <div className="p-6 text-center text-sm text-default-400">
              Sin resultados para "{busqueda}"
            </div>
          ) : (
            <div className="divide-y divide-default-100">
              {filtradas.map((t, i) => {
                const yaAgregada = misTareasWo.has(t.wo)

                return (
                  <div key={t.wo || i} className="px-4 py-3 hover:bg-default-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Chip size="sm" variant="flat" color={chipColor(t.id_atm)}
                            className="font-mono text-xs">
                            {t.id_atm}
                          </Chip>
                          <span className="text-xs font-mono text-default-400">{t.wo}</span>
                        </div>
                        <p className="text-sm font-medium text-default-800 leading-snug">{t.nombre}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="text-xs text-default-500">{t.ce || 'Sin usuario'}</span>
                          <span className="flex items-center gap-1 text-xs text-default-400">
                            <MapPin size={11} />{t.distrito}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-default-400">
                            <Clock size={11} />{t.hora}
                          </span>
                          {t.fecha && (
                            <span className="flex items-center gap-1 text-xs text-default-400">
                              <CalendarDays size={11} />{t.fecha}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        radius="lg"
                        color={yaAgregada ? 'success' : 'primary'}
                        variant={yaAgregada ? 'flat' : 'solid'}
                        startContent={yaAgregada ? <Check size={14} /> : <Plus size={14} />}
                        onPress={() => onAgregarAMisTareas?.(t)}
                        isDisabled={yaAgregada}
                        className="shrink-0"
                      >
                        {yaAgregada ? 'Agregada' : 'Agregar a Mis tareas'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollShadow>
      </CardBody>
    </Card>
  )
}

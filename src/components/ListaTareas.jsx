import { useState } from 'react'
import { Card, CardBody, CardHeader, Input, Chip, Divider, ScrollShadow } from '@heroui/react'
import { Search, MapPin, Clock } from 'lucide-react'

const chipColor = (id) => {
  if (!id) return 'default'
  if (id.startsWith('C')) return 'warning'
  if (id.startsWith('K')) return 'primary'
  return 'default'
}

export default function ListaTareas({ tareas }) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = tareas.filter(t => {
    const q = busqueda.toLowerCase()
    return (
      t.wo?.toLowerCase().includes(q) ||
      t.nombre?.toLowerCase().includes(q) ||
      t.ce?.toLowerCase().includes(q) ||
      t.distrito?.toLowerCase().includes(q) ||
      t.id_atm?.toLowerCase().includes(q)
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
              {filtradas.map((t, i) => (
                <div key={i} className="px-4 py-3 hover:bg-default-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Chip size="sm" variant="flat" color={chipColor(t.id_atm)}
                      className="font-mono text-xs">
                      {t.id_atm}
                    </Chip>
                    <span className="text-xs font-mono text-default-400">{t.wo}</span>
                  </div>
                  <p className="text-sm font-medium text-default-800 leading-snug">{t.nombre}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-default-500">{t.ce || 'Sin usuario'}</span>
                    <span className="flex items-center gap-1 text-xs text-default-400">
                      <MapPin size={11} />{t.distrito}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-default-400">
                      <Clock size={11} />{t.hora}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollShadow>
      </CardBody>
    </Card>
  )
}

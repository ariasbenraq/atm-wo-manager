import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react'
import { Palette, Check } from 'lucide-react'
import { PALETA, GRUPOS } from '../lib/coloresTarjeta'

// Botón que abre una paleta pequeña para elegir el color de fondo de las tarjetas de Lima y de Regiones
export default function PaletaColores({ colores, onCambiar, onRestablecer }) {
  return (
    <Popover placement="bottom-end" showArrow offset={8}>
      <PopoverTrigger>
        <Button size="sm" variant="flat" startContent={<Palette size={16} />} aria-label="Colores de las tarjetas">
          Colores
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 items-stretch gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">Color de las tarjetas</p>
        {GRUPOS.map(g => (
          <div key={g.clave} role="group" aria-label={`Color para ${g.etiqueta}`}>
            <p className="mb-1.5 text-xs text-default-500">
              <span className="font-medium text-foreground">{g.etiqueta}</span> · {g.ejemplo}
            </p>
            <div className="flex flex-wrap gap-2">
              {PALETA.map(c => {
                const activo = colores[g.clave] === c.clave
                return (
                  <button
                    key={c.clave}
                    type="button"
                    onClick={() => onCambiar(g.clave, c.clave)}
                    aria-label={`${g.etiqueta}: ${c.nombre}`}
                    aria-pressed={activo}
                    title={c.nombre}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ${c.muestra} ${
                      activo ? 'ring-2 ring-primary ring-offset-2 ring-offset-content1' : ''
                    }`}
                  >
                    {activo && <Check size={16} className="text-foreground" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <Button size="sm" variant="light" onPress={onRestablecer} className="self-start">
          Restablecer
        </Button>
      </PopoverContent>
    </Popover>
  )
}

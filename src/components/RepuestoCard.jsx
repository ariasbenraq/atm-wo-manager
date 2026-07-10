import {
  Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
} from '@heroui/react'
import { Package, Copy, Check, BookmarkPlus, Eye, Pencil, MoreHorizontal } from 'lucide-react'

export default function RepuestoCard({ repuesto, session, onCopy, onAddToList, onViewDetail, onEdit, copiandoId }) {
  const key = repuesto.id || repuesto.localId
  const fueCopiado = copiandoId === key

  return (
    <div className="group rounded-xl border border-default-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.06)] hover:border-default-300">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-default-50 p-2 text-default-400">
          <Package size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-default-900 leading-tight truncate">
            {repuesto.nombre}
          </p>
          <p className="mt-0.5 font-mono text-[13px] text-default-500 tabular-nums truncate">
            {repuesto.part_number}
          </p>
        </div>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              className="text-default-300 hover:text-default-500 transition-colors duration-150 min-w-8 h-8"
              aria-label="Menú de opciones"
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Opciones del repuesto"
            onAction={actionKey => {
              if (actionKey === 'view') onViewDetail(repuesto)
              if (actionKey === 'edit' && onEdit) onEdit(repuesto)
            }}
          >
            <DropdownItem key="view" startContent={<Eye size={14} />}>
              Ver detalle
            </DropdownItem>
            {onEdit && (
              <DropdownItem key="edit" startContent={<Pencil size={14} />}>
                Editar
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      </div>

      {(repuesto.compatibility || repuesto.tiene_stock !== undefined) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {repuesto.tiene_stock !== undefined && (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight ${
                repuesto.tiene_stock
                  ? 'bg-[#ECFDF5] text-[#065F46]'
                  : 'bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              {repuesto.tiene_stock ? 'En stock' : 'Sin stock'}
            </span>
          )}
          {repuesto.compatibility && (
            <span className="inline-flex items-center rounded-md bg-default-100 px-2 py-0.5 text-[11px] font-medium text-default-600 leading-tight">
              {repuesto.compatibility}
            </span>
          )}
        </div>
      )}

      {repuesto.descripcion && (
        <p className="mt-2 text-[13px] text-default-400 line-clamp-1 leading-snug">
          {repuesto.descripcion}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-default-100">
        <Button
          size="sm"
          variant="light"
          radius="lg"
          className="text-[13px] font-medium text-default-600 hover:bg-default-100 h-8 px-3 min-w-0 flex-1 basis-0"
          startContent={fueCopiado ? <Check size={14} className="text-success-500" /> : <Copy size={14} />}
          onPress={() => onCopy(repuesto)}
        >
          {fueCopiado ? 'Copiado' : 'Copiar PN'}
        </Button>
        <Button
          size="sm"
          variant="light"
          radius="lg"
          className="text-[13px] font-medium text-default-600 hover:bg-default-100 h-8 px-3 min-w-0 flex-1 basis-0"
          startContent={<BookmarkPlus size={14} />}
          isDisabled={!session}
          onPress={() => onAddToList(repuesto)}
        >
          Agregar a lista
        </Button>
      </div>
    </div>
  )
}

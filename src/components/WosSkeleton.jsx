import { Skeleton } from '@heroui/react'

// Skeleton compartido: carga inicial de la lista (HU-05) e importación (HU-07).
export default function WosSkeleton({ filas = 5, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-default-100 p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-3 w-2/3 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-3 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Estado vacío estándar: mensaje centrado, icono opcional y acción opcional.
export default function EmptyState({ icon, children, action }) {
  const Icono = icon
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-default-200 bg-content1 px-5 py-6 text-center text-sm text-default-500">
      {Icono && <Icono size={24} className="text-default-300" aria-hidden="true" />}
      <p>{children}</p>
      {action}
    </div>
  )
}

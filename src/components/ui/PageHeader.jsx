// Cabecera estándar de página: icono opcional, título (text-xl), subtítulo y acciones a la derecha.
export default function PageHeader({ icon, title, subtitle, actions }) {
  const Icono = icon
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icono && (
          <div className="shrink-0 rounded-xl bg-primary-50 p-2.5 text-primary-600">
            <Icono size={20} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-default-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Contenedor estándar: borde, fondo de contenido y relleno consistente (p-4; «sm» = p-3; «none» = sin relleno).
const RELLENO = { md: 'p-4', sm: 'p-3', none: '' }

export default function SectionCard({ padding = 'md', className = '', children, ...resto }) {
  return (
    <div
      className={`rounded-xl border border-default-200 bg-content1 shadow-sm ${RELLENO[padding]} ${className}`}
      {...resto}
    >
      {children}
    </div>
  )
}

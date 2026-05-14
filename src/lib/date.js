export function formatearFecha(fecha) {
  if (!fecha) return ''

  const texto = String(fecha).trim()
  if (!texto) return ''

  const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matchIso) {
    const [, year, month, day] = matchIso
    return `${day}/${month}/${year}`
  }

  const fechaNativa = new Date(texto)
  if (Number.isNaN(fechaNativa.getTime())) return texto

  const day = String(fechaNativa.getDate()).padStart(2, '0')
  const month = String(fechaNativa.getMonth() + 1).padStart(2, '0')
  const year = fechaNativa.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatearFechaHora(fecha) {
  if (!fecha) return ''

  const fechaNativa = new Date(fecha)
  if (Number.isNaN(fechaNativa.getTime())) return String(fecha)

  const fechaTexto = formatearFecha(fechaNativa)
  const horas = String(fechaNativa.getHours()).padStart(2, '0')
  const minutos = String(fechaNativa.getMinutes()).padStart(2, '0')

  return `${fechaTexto} ${horas}:${minutos}`
}

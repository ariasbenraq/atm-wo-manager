import * as XLSX from 'xlsx'

export function excelFechaAString(valor) {
  if (!valor) return null
  if (typeof valor === 'string') {
    const fechaTexto = valor.trim()
    if (!fechaTexto) return null

    const matchLatam = fechaTexto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
    if (matchLatam) {
      const dia = Number(matchLatam[1])
      const mes = Number(matchLatam[2])
      const anio = Number(matchLatam[3].length === 2 ? `20${matchLatam[3]}` : matchLatam[3])
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio >= 1900) {
        return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      }
    }

    const fechaNativa = new Date(fechaTexto)
    if (!Number.isNaN(fechaNativa.getTime())) {
      return fechaNativa.toISOString().split('T')[0]
    }

    return null
  }
  if (typeof valor === 'number') {
    const parsed = XLSX.SSF.parse_date_code(valor)
    if (!parsed) return null
    return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return null
}

export function excelHoraAString(valor) {
  if (!valor) return ''
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number') {
    const totalMinutos = Math.round(valor * 24 * 60)
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
  }
  return String(valor)
}

export function normalizarEncabezado(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

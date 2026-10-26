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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

const INDICE_MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6,
  ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11,
}

function primeraFechaDeMes(anio, mes) {
  if (!(anio >= 1900 && anio <= 2200) || !(mes >= 1 && mes <= 12)) return null
  return new Date(Date.UTC(anio, mes - 1, 1))
}

function serialAFecha(serial) {
  if (!Number.isFinite(serial) || serial < 1) return null
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed) return null
  return primeraFechaDeMes(parsed.y, parsed.m)
}

function mesAFecha(valor) {
  if (valor === null || valor === undefined) return null

  if (typeof valor === 'number') return serialAFecha(valor)

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return primeraFechaDeMes(valor.getUTCFullYear(), valor.getUTCMonth() + 1)
  }

  const txt = String(valor).trim().toLowerCase()
  if (!txt) return null

  if (/^\d+(\.\d+)?$/.test(txt)) return serialAFecha(Number(txt))

  const iso = txt.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/)
  if (iso) return primeraFechaDeMes(Number(iso[1]), Number(iso[2]))

  const mesAnio = txt.match(/^(\d{1,2})[/\-.](\d{2,4})$/)
  if (mesAnio) {
    const anio = Number(mesAnio[2])
    return primeraFechaDeMes(anio < 100 ? 2000 + anio : anio, Number(mesAnio[1]))
  }

  const letras = txt.match(/^([a-z]+)[\s\-./]*(\d{2,4})$/)
  if (letras) {
    const idx = INDICE_MESES[letras[1].slice(0, 3)]
    if (idx === undefined) return null
    const anio = Number(letras[2])
    const anioCompleto = anio < 100 ? (anio < 30 ? 2000 + anio : 1900 + anio) : anio
    return primeraFechaDeMes(anioCompleto, idx + 1)
  }

  return null
}

export function mesAISO(valor) {
  const fecha = mesAFecha(valor)
  return fecha ? fecha.toISOString().slice(0, 10) : ''
}

export function formatMes(valor) {
  const fecha = mesAFecha(valor)
  if (!fecha) return '-'
  return `${MESES_CORTOS[fecha.getUTCMonth()]}-${String(fecha.getUTCFullYear()).slice(-2)}`
}

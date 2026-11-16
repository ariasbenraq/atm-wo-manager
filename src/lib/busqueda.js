// Búsqueda de texto compartida por todas las pantallas con buscador.
// Reglas: ignora mayúsculas y tildes; el texto se parte en palabras y TODAS deben
// aparecer (en cualquiera de los campos indicados), sin importar el orden.

export function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function tokensDeBusqueda(texto) {
  return normalizarTexto(texto).split(/\s+/).filter(Boolean)
}

// campos: valores de la fila donde se busca (los null/undefined se ignoran).
// Con texto vacío siempre coincide.
export function coincideBusqueda(campos, texto) {
  const tokens = Array.isArray(texto) ? texto : tokensDeBusqueda(texto)
  if (!tokens.length) return true
  const normalizados = campos.map(normalizarTexto)
  return tokens.every(t => normalizados.some(c => c.includes(t)))
}

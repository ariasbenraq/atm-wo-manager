function formatearCopia(partNumber, unidades) {
  return `${partNumber || ''}\t${unidades ?? 1}`
}

function parsearPegado(texto) {
  const [partNumber, unidades] = texto.split('\t')
  return { partNumber, unidades }
}

// Test 1: Formato correcto con TAB
const resultado = formatearCopia('PN123456', 5)
console.assert(resultado === 'PN123456\t5', `Fallo: se esperaba 'PN123456\\t5' pero se obtuvo ${JSON.stringify(resultado)}`)
console.log('✓ Test 1: formatearCopia produce el formato correcto')

// Test 2: Sin espacios adicionales
console.assert(!resultado.includes(' '), 'Fallo: el resultado contiene espacios')
console.log('✓ Test 2: Sin espacios adicionales')

// Test 3: Sin saltos de línea
console.assert(!resultado.includes('\n'), 'Fallo: el resultado contiene saltos de línea')
console.log('✓ Test 3: Sin saltos de línea')

// Test 4: Parseo correcto
const parsed = parsearPegado(resultado)
console.assert(parsed.partNumber === 'PN123456', `Fallo: partNumber debería ser PN123456, se obtuvo ${parsed.partNumber}`)
console.assert(parsed.unidades === '5', `Fallo: unidades debería ser 5, se obtuvo ${parsed.unidades}`)
console.log('✓ Test 4: Parseo correcto al pegar')

// Test 5: Sin part_number (caso borde)
const sinPN = formatearCopia('', 3)
console.assert(sinPN === '\t3', `Fallo: caso sin part_number, se obtuvo ${JSON.stringify(sinPN)}`)
console.log('✓ Test 5: Sin part_number manejado correctamente')

// Test 6: Unidades por defecto
const sinUnid = formatearCopia('ABC-123', undefined)
console.assert(sinUnid === 'ABC-123\t1', `Fallo: unidades por defecto deberían ser 1, se obtuvo ${JSON.stringify(sinUnid)}`)
console.log('✓ Test 6: Unidades por defecto correctas')

console.log('\n✔ Todas las pruebas pasaron.')

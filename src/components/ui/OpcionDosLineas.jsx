// Opción de lista desplegable (Autocomplete) con texto principal a la izquierda y un dato a la derecha
// (con separación fija), y una segunda línea opcional.
//
// HeroUI virtualiza las listas de más de 50 opciones con una altura fija (32px por defecto).
// Si la opción es más alta, el texto se corta arriba y abajo. Por eso cada Autocomplete que use este
// componente debe recibir también las props de su preset (`{...LISTA_UNA_LINEA}` o `{...LISTA_DOS_LINEAS}`)
// y la opción su clase de altura (`className={CLASE_UNA_LINEA}` / `CLASE_DOS_LINEAS`), todo en `./listaOpciones`.
export default function OpcionDosLineas({ principal, derecha, derechaMono = false, secundario }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
      <div className="flex items-center justify-between gap-4">
        <span className={`min-w-0 break-words text-sm font-medium leading-tight text-foreground ${secundario ? 'truncate' : 'line-clamp-2'}`}>{principal}</span>
        {derecha && (
          <span className={`shrink-0 text-xs tabular-nums text-default-500 ${derechaMono ? 'font-mono' : ''}`}>
            {derecha}
          </span>
        )}
      </div>
      {secundario && <span className="truncate text-xs text-default-500">{secundario}</span>}
    </div>
  )
}

import { useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import FormularioCierre from '../components/FormularioCierre'

export default function MisTareasPage() {
  const { misTareas, marcarTareaCompletada, eliminarDeMisTareas, guardarTiemposMisTarea } = useApp()
  const [searchParams] = useSearchParams()
  const tareaInicialWo = searchParams.get('wo')

  return (
    <FormularioCierre
      key={tareaInicialWo || 'mis-tareas-default'}
      tareas={misTareas}
      onMarcarCompletada={marcarTareaCompletada}
      onEliminarTarea={eliminarDeMisTareas}
      onGuardarTiempos={guardarTiemposMisTarea}
      tareaInicialWo={tareaInicialWo}
    />
  )
}

import { useApp } from '../context/AppContext'
import ImportarExcel from '../components/ImportarExcel'
import FormularioNuevaTarea from '../components/FormularioNuevaTarea'
import ListaTareas from '../components/ListaTareas'

export default function TareasPage() {
  const { tareas, misTareas, cargarTareas, agregarAMisTareas, crearTareaManual, creandoTarea } = useApp()

  return (
    <div className="space-y-4">
      <ImportarExcel onImportado={cargarTareas} />
      <FormularioNuevaTarea
        onCrearTarea={crearTareaManual}
        cargando={creandoTarea}
      />
      <ListaTareas
        tareas={tareas}
        misTareas={misTareas}
        onAgregarAMisTareas={agregarAMisTareas}
      />
    </div>
  )
}

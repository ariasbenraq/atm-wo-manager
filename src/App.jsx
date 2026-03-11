import { useEffect, useState } from 'react'
import { syncFromSupabase } from './lib/sync'
import { db } from './lib/db'
import ImportarExcel from './components/ImportarExcel'
import ListaTareas from './components/ListaTareas'
import FormularioCierre from './components/FormularioCierre'
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Chip, Tabs, Tab } from '@heroui/react'
import { ClipboardList, FilePlus } from 'lucide-react'

export default function App() {
  const [tareas, setTareas] = useState([])
  const [syncing, setSyncing] = useState(true)
  const [vista, setVista] = useState('lista')

  async function cargarTareas() {
    const local = await db.tareas.toArray()
    setTareas(local)
  }

  useEffect(() => {
    async function init() {
      await cargarTareas()
      await syncFromSupabase()
      await cargarTareas()
      setSyncing(false)
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar isBordered maxWidth="sm" className="bg-white">
        <NavbarBrand>
          <p className="font-bold text-inherit tracking-tight font-mono">ATM·WO</p>
        </NavbarBrand>
        <NavbarContent justify="end">
          <NavbarItem>
            <Chip
              size="sm"
              variant="flat"
              color={syncing ? 'warning' : 'success'}
            >
              {syncing ? 'Sincronizando...' : `${tareas.length} tareas`}
            </Chip>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <Tabs
          fullWidth
          selectedKey={vista}
          onSelectionChange={setVista}
          color="primary"
          variant="solid"
          radius="lg"
        >
          <Tab
            key="lista"
            title={
              <div className="flex items-center gap-2">
                <ClipboardList size={16} />
                <span>Tareas</span>
              </div>
            }
          />
          <Tab
            key="formulario"
            title={
              <div className="flex items-center gap-2">
                <FilePlus size={16} />
                <span>Atención</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Contenido */}
      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {vista === 'lista' && (
          <>
            <ImportarExcel onImportado={cargarTareas} />
            <ListaTareas tareas={tareas} />
          </>
        )}
        {vista === 'formulario' && (
          <FormularioCierre tareas={tareas} />
        )}
      </main>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { syncFromSupabase } from './lib/sync'
import { db } from './lib/db'
import ImportarExcel from './components/ImportarExcel'
import ListaTareas from './components/ListaTareas'
import FormularioCierre from './components/FormularioCierre'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Chip,
  Tabs,
  Tab,
  Card,
  CardBody,
} from '@heroui/react'
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
    <div className="min-h-screen bg-gradient-to-b from-default-100 via-default-50 to-white">
      <Navbar isBordered maxWidth="md" className="bg-white/85 backdrop-blur-md">
        <NavbarBrand>
          <p className="font-bold text-inherit tracking-tight font-mono">ATM·WO</p>
        </NavbarBrand>
        <NavbarContent justify="end">
          <NavbarItem>
            <Chip size="sm" variant="flat" color={syncing ? 'warning' : 'success'}>
              {syncing ? 'Sincronizando...' : `${tareas.length} tareas`}
            </Chip>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 md:space-y-5 pb-10">
        <Card shadow="none" className="border border-default-200/70 rounded-2xl bg-white/80 backdrop-blur-sm">
          <CardBody className="p-2 md:p-3">
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
          </CardBody>
        </Card>

        {vista === 'lista' && (
          <>
            <ImportarExcel onImportado={cargarTareas} />
            <ListaTareas tareas={tareas} />
          </>
        )}
        {vista === 'formulario' && <FormularioCierre tareas={tareas} />}
      </main>
    </div>
  )
}

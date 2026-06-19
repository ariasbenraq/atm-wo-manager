import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TareasPage from './pages/TareasPage'
import MisTareasPage from './pages/MisTareasPage'
import RepuestosPage from './pages/RepuestosPage'
import MisListasPage from './pages/MisListasPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
          <Route path="/repuestos" element={<RepuestosPage />} />
          <Route path="/mis-listas" element={<MisListasPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/tareas" replace />} />
      </Routes>
    </AppProvider>
  )
}

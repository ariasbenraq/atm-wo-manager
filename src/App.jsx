import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TareasPage from './pages/TareasPage'
import MisTareasPage from './pages/MisTareasPage'
import WosPage from './pages/WosPage'
import RepuestosPage from './pages/RepuestosPage'
import MisListasPage from './pages/MisListasPage'
import AlmacenPage from './pages/AlmacenPage'
import PedidosPage from './pages/PedidosPage'
import AdminUsuariosPage from './pages/AdminUsuariosPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
          <Route path="/wos" element={<WosPage />} />
          <Route path="/repuestos" element={<RepuestosPage />} />
          <Route path="/mis-listas" element={<MisListasPage />} />
          <Route path="/almacen" element={<AlmacenPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/tareas" replace />} />
      </Routes>
    </AppProvider>
  )
}

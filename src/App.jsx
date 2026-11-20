import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegistroPage from './pages/RegistroPage'
import RestablecerClavePage from './pages/RestablecerClavePage'
import InicioPage from './pages/InicioPage'
import WosPage from './pages/WosPage'
import RepuestosPage from './pages/RepuestosPage'
import MisListasPage from './pages/MisListasPage'
import AlmacenPage from './pages/AlmacenPage'
import PedidosPage from './pages/PedidosPage'
import MovilidadesPage from './pages/MovilidadesPage'
import AdminUsuariosPage from './pages/AdminUsuariosPage'
import AdminMonitoreoPage from './pages/AdminMonitoreoPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/restablecer-clave" element={<RestablecerClavePage />} />
        <Route element={<Layout />}>
          <Route path="/inicio" element={<InicioPage />} />
          <Route path="/wos" element={<WosPage />} />
          <Route path="/repuestos" element={<RepuestosPage />} />
          <Route path="/mis-listas" element={<MisListasPage />} />
          <Route path="/almacen" element={<AlmacenPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/movilidades" element={<MovilidadesPage />} />
          <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
          <Route path="/admin/monitoreo" element={<AdminMonitoreoPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </AppProvider>
  )
}

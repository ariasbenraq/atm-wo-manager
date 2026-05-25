import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HeroUIProvider } from '@heroui/react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import App from './App.jsx'
import './index.css'
import 'dayjs/locale/es'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          <App />
        </LocalizationProvider>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

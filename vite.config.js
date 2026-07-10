import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl(),],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})

import { createClient } from '@supabase/supabase-js'
import { fetchConTelemetria } from './telemetria'
import { esModoDemo } from './demo/modoDemo'
import { clienteDemo } from './demo/clienteDemo'

const clienteReal = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchConTelemetria } }
)

// En modo demostración (cuenta `demo`) todas las llamadas van a un cliente en memoria:
// la base de datos real no recibe lecturas ni escrituras de esa sesión.
export const supabase = new Proxy(clienteReal, {
  get(objetivo, prop) {
    const origen = esModoDemo() && prop in clienteDemo ? clienteDemo : objetivo
    const valor = origen[prop]
    return typeof valor === 'function' ? valor.bind(origen) : valor
  },
})

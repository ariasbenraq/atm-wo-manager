import { createClient } from '@supabase/supabase-js'
import { fetchConTelemetria } from './telemetria'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchConTelemetria } }
)

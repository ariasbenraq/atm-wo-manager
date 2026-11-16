// Replaces __SUPABASE_ORIGIN__ in the nginx config with the origin of
// VITE_SUPABASE_URL, so the CSP allows exactly that Supabase project.
// Usage: node render-nginx-conf.mjs <input> <output>
// Never prints the URL or the anon key.
import { readFileSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
const raw = process.env.VITE_SUPABASE_URL

let origin
try {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('not https')
  origin = url.origin // scheme + host (+ port), no path
} catch {
  console.error('VITE_SUPABASE_URL is missing or is not a valid https URL (value not shown).')
  process.exit(1)
}
// The origin is written into an nginx config: allow only safe characters.
if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(origin)) {
  console.error('Supabase origin has unexpected characters (value not shown).')
  process.exit(1)
}

const template = readFileSync(input, 'utf8')
if (!template.includes('__SUPABASE_ORIGIN__')) {
  console.error('Placeholder __SUPABASE_ORIGIN__ not found in the nginx config.')
  process.exit(1)
}
writeFileSync(output, template.replaceAll('__SUPABASE_ORIGIN__', origin))
console.log('nginx config rendered with the Supabase origin.')

import fs from 'node:fs'
import path from 'node:path'
import { compile } from 'tailwindcss'

const ROOT = process.cwd()

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue
      walk(full, exts, out)
    } else if (exts.some((ext) => full.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

function collectCandidates() {
  const files = [
    ...walk(path.join(ROOT, 'src'), ['.js', '.jsx', '.ts', '.tsx', '.html']),
    ...walk(path.join(ROOT, 'node_modules', '@heroui'), ['.js', '.mjs']),
    path.join(ROOT, 'index.html'),
  ].filter((f) => fs.existsSync(f))

  const set = new Set(['dark'])
  const tokenRegex = /[A-Za-z0-9_:\-\/\.\[\]\(%\)#]+/g

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const tokens = text.match(tokenRegex) || []
    for (const token of tokens) {
      if (token.length < 2 || token.length > 120) continue
      if (!/[\-:\[]/.test(token)) continue
      set.add(token)
    }
  }

  return [...set]
}

async function loadStylesheet(id, base) {
  let file
  if (id === 'tailwindcss') {
    file = path.join(ROOT, 'node_modules', 'tailwindcss', 'index.css')
  } else if (id.startsWith('tailwindcss/')) {
    file = path.join(ROOT, 'node_modules', id)
  } else {
    file = path.resolve(base, id)
  }

  return {
    content: fs.readFileSync(file, 'utf8'),
    base: path.dirname(file),
  }
}

const input = `
@import "tailwindcss/theme.css";
@import "tailwindcss/preflight.css";

@theme {
  --color-default-50: #f8fafc;
  --color-default-100: #f1f5f9;
  --color-default-200: #e2e8f0;
  --color-default-300: #cbd5e1;
  --color-default-400: #94a3b8;
  --color-default-500: #64748b;
  --color-default-600: #475569;
  --color-default-700: #334155;
  --color-default-800: #1e293b;
  --color-default-900: #0f172a;

  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;

  --color-success-500: #22c55e;
  --color-warning-500: #f59e0b;
}

@tailwind utilities;
`

const compiler = await compile(input, {
  from: path.join(ROOT, 'src', 'index.css'),
  loadStylesheet,
})

const css = compiler.build(collectCandidates())
fs.writeFileSync(path.join(ROOT, 'src', 'tailwind.generated.css'), css)
console.log(`Generated src/tailwind.generated.css (${css.length} bytes)`)

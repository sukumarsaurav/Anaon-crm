#!/usr/bin/env node
/**
 * Runs every `.from('table').select('...')` found in src/ against the real database (read-only,
 * limit 1) and reports the ones PostgREST rejects — bad columns, missing relationships, wrong FK
 * hints. Those failures are silent in the app (a failed query reads as "no rows").
 *   node tests/sql/select-sweep.mjs            (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]))
const base = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY

const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (f === 'graphify-out' || f === 'node_modules') continue; statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p) } return out }
const seen = new Map()
for (const file of walk('src')) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)\s*\.select\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) {
    const sel = m[2].slice(1, -1).replace(/\$\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
    if (!sel || sel === '*') continue
    const k = m[1] + '|' + sel
    if (!seen.has(k)) seen.set(k, [])
    seen.get(k).push(path.relative('src', file))
  }
}
let bad = 0
for (const [k, files] of seen) {
  const [table, sel] = k.split('|')
  const r = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(sel)}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) { bad++; const t = await r.json().catch(() => ({})); console.log(`✗ ${table}: ${t.message ?? r.status}\n    select: ${sel.slice(0, 160)}\n    in: ${[...new Set(files)].join(', ')}`) }
}
console.log(`\n${seen.size - bad}/${seen.size} selects accepted by the database`)
process.exit(bad ? 1 : 0)

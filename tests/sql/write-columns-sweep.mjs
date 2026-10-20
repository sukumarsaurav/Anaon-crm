#!/usr/bin/env node
/**
 * Static check of every `.from('table').insert/update/upsert({ ... })` in src/: each top-level key must be
 * a real column of that table (taken from the database's PostgREST schema). A wrong column makes the
 * write fail; several callers ignore the error.
 *   node tests/sql/write-columns-sweep.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]))
const spec = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json()
const cols = Object.fromEntries(Object.entries(spec.definitions ?? {}).map(([t, d]) => [t, new Set(Object.keys(d.properties ?? {}))]))

// Generated columns are listed by PostgREST like any other, but writing one fails
// ("cannot insert a non-DEFAULT value"). Keep in sync with
// `select table_name, column_name from information_schema.columns where is_generated = 'ALWAYS'`.
const GENERATED = { plots: new Set(['total_price']) }

const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (f === 'graphify-out' || f === 'node_modules') continue; statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p) } return out }

/** Top-level keys of the object literal that starts at text[i] === '{'. */
function topKeys(text, i) {
  const keys = []; let depth = 0, k = i
  let expectKey = true
  for (; k < text.length; k++) {
    const c = text[k]
    if (c === '"' || c === "'" || c === '`') { const q = c; k++; while (k < text.length && text[k] !== q) { if (text[k] === '\\') k++; k++ } continue }
    if (c === '/' && text[k + 1] === '/') { while (k < text.length && text[k] !== '\n') k++; continue }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue }
    if (c === '{' || c === '(' || c === '[') { if (depth === 1 && c === '[') expectKey = false /* computed key */; depth++; if (depth === 1) { expectKey = true } continue }
    if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) break; continue }
    if (depth === 1) {
      if (c === ',') { expectKey = true; continue }
      if (expectKey) {
        const m = /^(\.\.\.[A-Za-z_.]+|[A-Za-z_][A-Za-z0-9_]*)\s*([:,}]|\n)/.exec(text.slice(k, k + 90))
        if (m) { if (!m[1].startsWith('...')) keys.push(m[1]); k += m[1].length - 1; expectKey = false }
      }
    }
  }
  return keys
}

let bad = 0, checked = 0
for (const file of walk('src')) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)\s*\.(insert|update|upsert)\(\s*(\[\s*)?\{/g)) {
    const table = m[1]
    if (!cols[table]) continue
    const braceAt = m.index + m[0].length - 1
    const keys = topKeys(text, braceAt)
    checked++
    const unknown = keys.filter((k) => !cols[table].has(k) || GENERATED[table]?.has(k))
    if (unknown.length) { bad++; console.log(`✗ ${table}.${m[2]}  unknown or generated column(s): ${unknown.join(', ')}\n    in ${path.relative('src', file)}:${text.slice(0, m.index).split('\n').length}`) }
  }
}
console.log(`\n${checked - bad}/${checked} write payloads use only real columns`)
process.exit(bad ? 1 : 0)

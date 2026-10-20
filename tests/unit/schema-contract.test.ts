import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import fixture from '../fixtures/db-foreign-keys.json'

/**
 * The app talks to PostgREST with embeds like `broker:brokers!bookings_broker_id_fkey(...)`. A wrong
 * constraint name makes the WHOLE query fail, and most callers treat a failed query as "no rows": the
 * Bookings list showed "0 results", booking pages returned 404 and the plot map was empty — with no
 * error anywhere. This test checks every hint against the real schema (tests/fixtures).
 */
const known = new Set(fixture.foreignKeys.map((k: string) => k.split('.')[1]))

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (f === 'graphify-out' || f === 'node_modules') continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(f)) out.push(p)
  }
  return out
}

describe('PostgREST embeds match the database schema', () => {
  const src = path.resolve(__dirname, '../../src')
  const used = new Map<string, string[]>()
  for (const file of walk(src)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/!([a-z_]+_(?:fkey|fk))\b/g)) {
      used.set(m[1], [...(used.get(m[1]) ?? []), path.relative(src, file)])
    }
  }
  it('finds the hints (sanity: the scan is not empty)', () => expect(used.size).toBeGreaterThan(30))
  it('every `table!constraint` hint names a constraint that exists', () => {
    const missing = [...used].filter(([name]) => !known.has(name)).map(([name, files]) => `${name} (${[...new Set(files)].join(', ')})`)
    expect(missing).toEqual([])
  })
  it('never embeds profiles through audit_logs.user_id (it points at auth.users)', () => {
    for (const file of walk(src)) {
      const text = readFileSync(file, 'utf8')
      expect(/profiles:user_id/.test(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), file).toBe(false)
    }
  })
})

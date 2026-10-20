#!/usr/bin/env node
// Fails when UI code drifts from the design-system rules in src/components/ui/README.md.
// Run: npm run lint:ui
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname

const RULES = [
  { name: 'native confirm()/alert()/prompt()', re: /(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\(/, hint: 'use useConfirm()/usePrompt()/useToast() from components/ui' },
  { name: 'gray/zinc/neutral palette', re: /\b(?:bg|text|border|ring|divide|from|to|via)-(?:gray|zinc|neutral)-\d+/, hint: 'use slate-*' },
  { name: 'rounded-2xl / rounded-3xl', re: /\brounded-(?:2xl|3xl)\b/, hint: 'use rounded-xl (surfaces) or rounded-lg (controls)', skip: /MessageBubble|\(auth\)|OtpLoginForm|client-portal\/page\.tsx/ },
  { name: 'sub-12px text', re: /text-\[(?:9|10|11)px\]/, hint: 'use text-xs' },
  { name: 'hand-rolled modal overlay', re: /fixed inset-0[^"']*(?:items-center|justify-center)/, hint: 'use components/ui/Modal', skip: /ui\/Modal|CommandPalette|DashboardLayout|Sidebar|ui\/Toast/ },
]

const files = []
const walk = (d) => {
  for (const n of readdirSync(d)) {
    if (n === 'graphify-out' || n === 'node_modules') continue
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) files.push(p)
  }
}
walk(ROOT)

let failures = 0
for (const f of files) {
  const rel = relative(ROOT, f)
  const lines = readFileSync(f, 'utf8').split('\n')
  for (const rule of RULES) {
    if (rule.skip?.test(rel)) continue
    lines.forEach((line, i) => {
      if (rule.re.test(line)) {
        failures++
        console.error(`src/${rel}:${i + 1}  ${rule.name} — ${rule.hint}`)
      }
    })
  }
}
if (failures) {
  console.error(`\n${failures} UI rule violation(s).`)
  process.exit(1)
}
console.log('UI rules: OK')

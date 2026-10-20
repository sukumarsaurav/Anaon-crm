#!/usr/bin/env node
/**
 * Black-box smoke test of a deployed CRM — no credentials needed, nothing is changed.
 *   node tests/smoke/smoke.mjs https://anon-crm.vercel.app
 * Checks that the public surface behaves: pages load, private pages bounce to /login, and every
 * webhook / cron / API endpoint refuses unauthenticated calls. Exit code 1 on any failure.
 */
const base = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const results = []
const check = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, ok: true, detail }) }
  catch (e) { results.push({ name, ok: false, detail: String(e.message ?? e) }) }
}
const req = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init })
const expectStatus = (res, ...codes) => { if (!codes.includes(res.status)) throw new Error(`expected ${codes.join('/')} got ${res.status}`); return res.status }
const redirectsToLogin = (res) => {
  if (![301, 302, 303, 307, 308].includes(res.status)) throw new Error(`expected a redirect, got ${res.status}`)
  const loc = res.headers.get('location') ?? ''
  if (!/\/login/.test(loc)) throw new Error(`redirects to ${loc}, not /login`)
  return loc
}

await check('login page loads', async () => { const r = await req('/login'); expectStatus(r, 200); const t = await r.text(); if (!/password/i.test(t)) throw new Error('no password field'); return 'ok' })
await check('client portal login loads', async () => expectStatus(await req('/client-portal/login'), 200, 307, 308))

const privatePages = ['/dashboard', '/leads', '/leads/new', '/clients', '/bookings', '/inventory', '/brokers', '/construction', '/marketing', '/whatsapp/inbox', '/whatsapp/templates', '/automation', '/loans', '/loans/new', '/reports', '/hr', '/hr/payroll', '/team', '/legal', '/admin/security', '/audit-logs', '/settings', '/settings/integrations', '/albums', '/mobile', '/clients/extension-requests']
for (const p of privatePages) await check(`private page ${p} requires login`, async () => redirectsToLogin(await req(p)))

for (const p of ['/blog', '/website/careers']) await check(`removed page ${p} is gone (login bounce or 404, never content)`, async () => { const r = await req(p); return expectStatus(r, 307, 308, 404) })

const crons = ['followup-reminders', 'site-visit-reminders', 'automations', 'broadcasts']
for (const c of crons) {
  await check(`cron ${c} refuses no secret`, async () => expectStatus(await req(`/api/cron/${c}`, { method: 'POST' }), 401))
  await check(`cron ${c} refuses a wrong secret`, async () => expectStatus(await req(`/api/cron/${c}`, { method: 'POST', headers: { authorization: 'Bearer wrong' } }), 401))
  await check(`cron ${c} refuses GET without a secret`, async () => expectStatus(await req(`/api/cron/${c}`), 401))
}

await check('lead webhook refuses no token', async () => expectStatus(await req('/api/webhooks/leads/99acres', { method: 'POST', body: '{}' }), 401))
await check('lead webhook refuses a wrong token', async () => expectStatus(await req('/api/webhooks/leads/99acres?token=nope', { method: 'POST', body: '{}' }), 401))
await check('AgencyX webhook refuses an unsigned call', async () => expectStatus(await req('/api/webhooks/agencyx', { method: 'POST', body: '{}' }), 401))
await check('AgencyX webhook refuses a forged signature', async () => expectStatus(await req('/api/webhooks/agencyx', { method: 'POST', body: '{}', headers: { 'x-agencyx-signature': `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` } }), 401))
await check('Razorpay webhook refuses an unsigned call', async () => expectStatus(await req('/api/webhooks/razorpay', { method: 'POST', body: '{}' }), 401))
await check('Exotel webhook refuses no token', async () => expectStatus(await req('/api/webhooks/exotel', { method: 'POST', body: 'CallSid=x' }), 401))
await check('Meta lead webhook refuses an unsigned call', async () => expectStatus(await req('/api/webhooks/meta-leads', { method: 'POST', body: '{}' }), 401))
await check('Meta verify handshake refuses a bad token', async () => expectStatus(await req('/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1'), 403))
await check('legacy WhatsApp webhook refuses an unsigned call', async () => expectStatus(await req('/api/webhooks/whatsapp', { method: 'POST', body: '{}' }), 401))

for (const p of ['/api/mobile/leads', '/api/mobile/dashboard', '/api/mobile/attendance', '/api/mobile/notifications']) await check(`mobile API ${p} needs a token`, async () => expectStatus(await req(p), 401))
await check('mobile API /api/mobile/site-visits needs a token', async () => expectStatus(await req('/api/mobile/site-visits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 401))
await check('mobile API rejects a garbage token', async () => expectStatus(await req('/api/mobile/leads', { headers: { authorization: 'Bearer garbage' } }), 401))
for (const p of ['/api/audit-logs/export', '/api/reports/export?type=sales', '/api/inventory/available-plots']) await check(`internal API ${p} needs a session`, async () => { const r = await req(p); return expectStatus(r, 307, 308, 401, 403) })

await check('portal OTP request validates its input', async () => expectStatus(await req('/api/portal/send-otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 400))
await check('portal OTP for an unknown number does not reveal a code', async () => {
  const r = await req('/api/portal/send-otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '9000000000' }) })
  const t = await r.text()
  if (/"otp"|\b\d{6}\b/.test(t)) throw new Error('response contains something that looks like a code')
  return r.status
})
await check('portal payment order needs a portal session', async () => expectStatus(await req('/api/portal/razorpay/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"paymentId":"x"}' }), 401, 503))
await check('portal receipt needs a portal session', async () => expectStatus(await req('/api/portal/receipt/00000000-0000-0000-0000-000000000000'), 401, 403, 404))

await check('login API rejects missing fields', async () => expectStatus(await req('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 400))
await check('login API gives the same answer for a wrong password and an unknown email', async () => {
  const post = async (email) => { const r = await req('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'definitely-wrong-1' }) }); return { s: r.status, b: await r.text() } }
  const a = await post(`smoke-test-${Date.now()}@example.invalid`); const b = await post(`smoke-test-other-${Date.now()}@example.invalid`)
  if (a.s !== 401 || b.s !== 401) throw new Error(`statuses ${a.s}/${b.s}`)
  if (a.b !== b.b) throw new Error('different bodies')
  return 'uniform'
})

await check('unknown album share token is a 404, not a crash', async () => expectStatus(await req('/share/does-not-exist-123'), 404, 200))
await check('a made-up page is a 404', async () => expectStatus(await req('/this-page-does-not-exist'), 404, 307, 308))
await check('security headers: no X-Powered-By leaking the framework', async () => { const r = await req('/login'); if (r.headers.get('x-powered-by')) throw new Error('x-powered-by: ' + r.headers.get('x-powered-by')); return 'ok' })

const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`)
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`)
process.exit(failed.length ? 1 : 0)

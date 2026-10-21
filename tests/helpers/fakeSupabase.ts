/**
 * A small in-memory stand-in for the Supabase client, enough for the CRM's server actions:
 * select/insert/update/upsert/delete with eq, neq, in, is, not, gt(e), lt(e), like/ilike,
 * order, limit, single, maybeSingle, count. Joined selects ("clients(full_name)") return
 * the base row only; give a table a `joins` resolver when a test needs them.
 */
import { randomUUID } from 'node:crypto'

export type Row = Record<string, any>
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null }
type Filter = (r: Row) => boolean

export interface FakeOptions {
  /** Throw a Postgres-style error before an insert/update lands (e.g. unique violations). */
  beforeWrite?: (table: string, op: 'insert' | 'update' | 'delete', rows: Row[], db: FakeDb) => { message: string; code?: string } | null
  rpc?: Record<string, (args: any) => any>
  /** Column defaults the real database applies on insert. */
  defaults?: Record<string, Row>
}

/** Column lookup that also reaches into embedded rows: "bookings.status" → row.bookings.status. */
function get(r: Row, path: string): any {
  if (path in r) return r[path]
  return path.split('.').reduce((acc: any, k) => (acc == null ? undefined : acc[k]), r)
}

function like(value: unknown, pattern: string, ci: boolean): boolean {
  if (value == null) return false
  // % and _ are wildcards unless escaped with a backslash, as in Postgres.
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) { re += pattern[++i].replace(/[.+^${}()|[\]\\*?]/g, '\\$&'); continue }
    re += c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
  }
  return new RegExp('^' + re + '$', ci ? 'i' : '').test(String(value))
}

export class FakeDb {
  tables: Record<string, Row[]> = {}
  log: Array<{ table: string; op: string; payload?: any }> = []
  constructor(seed: Record<string, Row[]> = {}, public opts: FakeOptions = {}) {
    for (const [k, v] of Object.entries(seed)) this.tables[k] = v.map((r) => ({ ...r }))
  }
  rows(table: string) { return (this.tables[table] ??= []) }
  from(table: string) { return new Query(this, table) }
  rpc(name: string, args: any): Promise<Result> {
    const fn = this.opts.rpc?.[name]
    if (!fn) return Promise.resolve({ data: null, error: { message: `function ${name} does not exist`, code: '42883' } })
    return Promise.resolve({ data: fn(args), error: null })
  }
  signedOut = false
  users: Array<{ id: string; email: string; app_metadata?: any; user_metadata?: any; banned?: boolean; password?: string }> = []
  auth = {
    getClaims: async () => ({ data: { claims: null } }),
    tokens: {} as Record<string, { id: string; email: string }>,
    credentials: {} as Record<string, { password: string; id: string }>,
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const c = this.auth.credentials[email.toLowerCase()]
      return c && c.password === password
        ? { data: { user: { id: c.id, email }, session: { access_token: `tok-${c.id}-xxxxxxxxxxxxxxxxxxxxxxxx` } }, error: null }
        : { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
    },
    signOut: async () => { this.signedOut = true; return { error: null } },
    getUser: async (token: string) => { const u = this.auth.tokens[token]; return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'bad token' } } },
    admin: {
      listUsers: async ({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) => ({ data: { users: this.users.slice((page - 1) * perPage, page * perPage) }, error: null }),
      createUser: async (a: any) => {
        if (this.users.some((u) => u.email.toLowerCase() === String(a.email).toLowerCase())) return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } }
        const user = { id: randomUUID(), email: a.email, app_metadata: a.app_metadata, user_metadata: a.user_metadata, password: a.password }
        this.users.push(user)
        // handle_new_user(): role comes from service-only app_metadata
        this.rows('profiles').push({ id: user.id, email: a.email, full_name: a.user_metadata?.full_name ?? a.email, role: a.app_metadata?.role === 'broker' ? 'broker' : 'sales_advisor', is_active: true })
        return { data: { user }, error: null }
      },
      deleteUser: async (id: string) => { this.users = this.users.filter((u) => u.id !== id); this.tables.profiles = this.rows('profiles').filter((p) => p.id !== id); return { error: null } },
      updateUserById: async (id: string, patch: any) => {
        const u = this.users.find((x) => x.id === id)
        if (u) {
          if ('ban_duration' in patch) u.banned = patch.ban_duration && patch.ban_duration !== 'none'
          if (patch.password) u.password = patch.password
          if (patch.email) u.email = patch.email
          // GoTrue merges app_metadata; a null value removes the key.
          if (patch.app_metadata) {
            u.app_metadata = { ...(u.app_metadata ?? {}) }
            for (const [k, v] of Object.entries(patch.app_metadata)) { if (v === null) delete u.app_metadata[k]; else u.app_metadata[k] = v }
          }
        }
        return { data: { user: u }, error: null }
      },
    },
  }
  storage = { from: () => ({ remove: async () => ({ error: null }), upload: async () => ({ error: null }), createSignedUrls: async () => ({ data: [] }), list: async () => ({ data: [], error: null }), createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/upload/${path}?token=t`, token: 't', path }, error: null }) }) }
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = []
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: any
  private wantRows = false
  private singleMode: 'one' | 'maybe' | null = null
  private orderBy: Array<{ col: string; asc: boolean }> = []
  private max: number | null = null
  private countMode = false
  private headOnly = false
  private onConflict?: string
  private ignoreDup = false

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.op = 'select'
    this.wantRows = true
    if (opts?.count) this.countMode = true
    if (opts?.head) this.headOnly = true
    return this
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  upsert(p: any, o?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict; this.ignoreDup = !!o?.ignoreDuplicates; return this }
  delete() { this.op = 'delete'; return this }

  eq(c: string, v: any) { this.filters.push((r) => get(r, c) === v); return this }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this }
  not(c: string, o: string, v: any) {
    if (o === 'is') this.filters.push((r) => !(v === null ? r[c] == null : r[c] === v))
    else if (o === 'in') { const list = String(v).replace(/[()"]/g, '').split(','); this.filters.push((r) => !list.includes(String(r[c]))) }
    else if (o === 'eq') this.filters.push((r) => r[c] !== v)
    return this
  }
  gt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] > v); return this }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this }
  lt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] < v); return this }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this }
  like(c: string, p: string) { this.filters.push((r) => like(r[c], p, false)); return this }
  ilike(c: string, p: string) { this.filters.push((r) => like(r[c], p, true)); return this }
  /** PostgREST `or=(a.eq.1,b.in.(x,y),c.ilike."%t%")`, for eq / neq / gt(e) / lt(e) / is / in / like / ilike. */
  or(expr: string) {
    const parts: string[] = []
    let depth = 0, quoted = false, cur = ''
    for (const ch of expr) {
      if (ch === '"') quoted = !quoted
      if (!quoted && ch === '(') depth++
      if (!quoted && ch === ')') depth--
      if (!quoted && depth === 0 && ch === ',') { parts.push(cur); cur = ''; continue }
      cur += ch
    }
    if (cur) parts.push(cur)
    const tests = parts.map((p) => {
      const [col, op, ...rest] = p.split('.')
      const raw = rest.join('.')
      const val = raw.replace(/^"|"$/g, '').replace(/\\"/g, '"')
      return (r: Row): boolean => {
        const v = r[col]
        switch (op) {
          case 'eq': return String(v) === val
          case 'neq': return String(v) !== val
          case 'gt': return v != null && v > val
          case 'gte': return v != null && v >= val
          case 'lt': return v != null && v < val
          case 'lte': return v != null && v <= val
          case 'is': return val === 'null' ? v == null : String(v) === val
          case 'in': return raw.replace(/[()"]/g, '').split(',').includes(String(v))
          case 'like': return like(v, val, false)
          case 'ilike': return like(v, val, true)
          default: return false
        }
      }
    })
    this.filters.push((r) => tests.some((t) => t(r)))
    return this
  }
  order(c: string, o?: { ascending?: boolean }) { this.orderBy.push({ col: c, asc: o?.ascending !== false }); return this }
  limit(n: number) { this.max = n; return this }
  range() { return this }
  single() { this.singleMode = 'one'; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }

  private match() { return this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r))) }

  private exec(): Result {
    const t = this.table
    const fail = (e: { message: string; code?: string }): Result => ({ data: null, error: e })
    this.db.log.push({ table: t, op: this.op, payload: this.payload })

    if (this.op === 'insert' || this.op === 'upsert') {
      const rows: Row[] = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row): Row => ({ id: randomUUID(), created_at: new Date().toISOString(), ...(this.db.opts.defaults?.[t] ?? {}), ...r }))
      if (this.op === 'upsert' && this.onConflict) {
        const out: Row[] = []
        for (const r of rows) {
          const keys = this.onConflict.split(',').map((k) => k.trim())
          const ex = this.db.rows(t).find((x) => keys.every((k) => x[k] === r[k]))
          if (ex) { if (!this.ignoreDup) Object.assign(ex, r, { id: ex.id }); out.push(ex) } else { this.db.rows(t).push(r); out.push(r) }
        }
        return this.finish(out)
      }
      const err = this.db.opts.beforeWrite?.(t, 'insert', rows, this.db)
      if (err) return fail(err)
      this.db.rows(t).push(...rows)
      return this.finish(rows)
    }
    if (this.op === 'update') {
      const hit = this.match()
      const err = this.db.opts.beforeWrite?.(t, 'update', hit, this.db)
      if (err) return fail(err)
      for (const r of hit) Object.assign(r, this.payload)
      return this.finish(hit)
    }
    if (this.op === 'delete') {
      const hit = this.match()
      const err = this.db.opts.beforeWrite?.(t, 'delete', hit, this.db)
      if (err) return fail(err)
      this.db.tables[t] = this.db.rows(t).filter((r) => !hit.includes(r))
      return this.finish(hit)
    }
    return this.finish(this.match())
  }

  private finish(rows: Row[]): Result {
    let out = rows.map((r) => ({ ...r }))
    for (const o of [...this.orderBy].reverse()) {
      out.sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1))
    }
    const count = this.countMode ? out.length : null
    if (this.max != null) out = out.slice(0, this.max)
    if (this.headOnly) return { data: null, error: null, count }
    if (this.singleMode === 'one') {
      return out.length === 1 ? { data: out[0], error: null, count } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count }
    }
    if (this.singleMode === 'maybe') return { data: out[0] ?? null, error: null, count }
    // A write without .select() returns no rows, like PostgREST.
    const returnsRows = this.op === 'select' || this.wantRows
    return { data: returnsRows ? out : null, error: null, count }
  }

  then<T1 = Result, T2 = never>(ok?: ((v: Result) => T1 | PromiseLike<T1>) | null, bad?: ((e: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return Promise.resolve(this.exec()).then(ok, bad)
  }
}

export function fakeDb(seed: Record<string, Row[]> = {}, opts: FakeOptions = {}) { return new FakeDb(seed, opts) }

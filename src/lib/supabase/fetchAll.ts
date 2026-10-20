/**
 * PostgREST returns at most 1,000 rows per request (the project's max-rows), silently. Reports that
 * counted rows in code therefore stopped counting at 1,000. These helpers page through everything.
 */

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Reads every row. `page(from, to)` must build a fresh query each call (builders are single-use)
 * and apply `.range(from, to)`. Give it a stable order, or rows can repeat or go missing between pages.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>, pageSize = 1000, maxRows = 100_000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) {
      console.error('[fetchAll] query failed:', error.message)
      break
    }
    out.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return out
}

/** Splits a long id list for `.in()` filters, which otherwise overflow the request URL. */
export async function inChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>, size = 200): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += size) out.push(...(await run(ids.slice(i, i + size))))
  return out
}

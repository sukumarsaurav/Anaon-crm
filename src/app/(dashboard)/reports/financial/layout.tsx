import { requireManagerPage } from '@/lib/auth/pageGate'

/** Manager-only menu: see requireManagerPage. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireManagerPage()
  return children
}

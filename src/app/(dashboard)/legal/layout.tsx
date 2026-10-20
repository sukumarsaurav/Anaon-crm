import { requireManagerPage } from '@/lib/auth/pageGate'
import LegalTabs from '@/components/legal/LegalTabs'

/** Manager-only menu: the sidebar hid it, but the URL opened for every role. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireManagerPage()
  return <LegalTabs>{children}</LegalTabs>
}

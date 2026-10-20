import { requireManagerPage } from '@/lib/auth/pageGate'
import AutomationTabs from '@/components/automation/AutomationTabs'

/** Manager-only menu: the sidebar hid it, but the URL opened for every role. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireManagerPage()
  return <AutomationTabs>{children}</AutomationTabs>
}

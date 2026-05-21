'use client'

import { useRouter } from 'next/navigation'
import { updateSecuritySettings } from '@/lib/security/actions'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface Settings {
  max_failed_attempts: number
  lockout_minutes: number
  session_timeout_minutes: number
}

export default function SecuritySettingsForm({ settings }: { settings: Settings | null }) {
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    await updateSecuritySettings(formData)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Input
        name="max_failed_attempts"
        label="Max Failed Login Attempts"
        type="number"
        min={3}
        max={20}
        defaultValue={settings?.max_failed_attempts ?? 5}
        hint="Before lockout triggers"
      />
      <Input
        name="lockout_minutes"
        label="Lockout Duration (minutes)"
        type="number"
        min={5}
        max={1440}
        defaultValue={settings?.lockout_minutes ?? 30}
        hint="How long account stays locked"
      />
      <Input
        name="session_timeout_minutes"
        label="Session Timeout (minutes)"
        type="number"
        min={15}
        max={480}
        defaultValue={settings?.session_timeout_minutes ?? 60}
        hint="Inactivity before auto-logout"
      />
      <div className="sm:col-span-3">
        <Button type="submit">Save Policy</Button>
      </div>
    </form>
  )
}

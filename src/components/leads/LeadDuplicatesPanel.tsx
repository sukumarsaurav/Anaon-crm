'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, GitMerge, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StageBadge from './StageBadge'
import RelativeTime from '@/components/ui/RelativeTime'
import { mergeDuplicate } from '@/lib/leads/actions'
import type { DuplicateCheck } from '@/types/leads'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Props {
  currentLeadId: string
  duplicates: DuplicateCheck['leads']
}

export default function LeadDuplicatesPanel({ currentLeadId, duplicates }: Props) {
  const router = useRouter()
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const askConfirm = useConfirm()

  if (!duplicates.length) return null

  async function handleMerge(dupeId: string) {
    if (!(await askConfirm({ title: 'Merge duplicate', message: 'Merge this duplicate into the current lead? Its activities and site visits will move here, and the duplicate will be retired. This cannot be undone.', confirmLabel: 'Merge' }))) return
    setMergingId(dupeId)
    setError(null)
    const res = await mergeDuplicate(currentLeadId, dupeId)
    setMergingId(null)
    if (!res.success) { setError(res.error ?? 'Merge failed'); return }
    router.refresh()
  }

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Possible duplicates ({duplicates.length})
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        These leads share this lead&apos;s phone or email. Merge keeps the current record and moves the
        duplicate&apos;s history here.
      </p>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="space-y-2">
        {duplicates.map((d) => (
          <div key={d.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 truncate">{d.full_name}</p>
                <StageBadge stage={d.stage} size="sm" />
                <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  <Copy size={10} /> {d.match_type}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {d.phone}
                {d.assigned_profile?.full_name ? ` · ${d.assigned_profile.full_name}` : ' · Unassigned'}
                {' · '}<RelativeTime date={d.created_at} />
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/leads/${d.id}`} target="_blank">
                <Button variant="ghost" size="xs">View</Button>
              </Link>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleMerge(d.id)}
                loading={mergingId === d.id}
              >
                <GitMerge size={13} /> Merge in
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

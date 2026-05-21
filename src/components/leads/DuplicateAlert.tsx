'use client'

import { AlertTriangle } from 'lucide-react'
import type { DuplicateCheck } from '@/types/leads'
import StageBadge from './StageBadge'
import RelativeTime from '@/components/ui/RelativeTime'
import Button from '@/components/ui/Button'
import Link from 'next/link'

interface DuplicateAlertProps {
  duplicate: DuplicateCheck
  onContinue: () => void
  onCancel: () => void
}

export default function DuplicateAlert({ duplicate, onContinue, onCancel }: DuplicateAlertProps) {
  if (!duplicate.found) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900">
            Duplicate Lead Detected
          </h4>
          <p className="text-xs text-amber-700 mt-0.5">
            A lead with this phone number or email already exists.
          </p>

          <div className="mt-3 space-y-2">
            {duplicate.leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-lg border border-amber-200 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{lead.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {lead.assigned_profile?.full_name
                      ? `Assigned to: ${lead.assigned_profile.full_name}`
                      : 'Unassigned'}{' '}
                    · Added <RelativeTime date={lead.created_at} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StageBadge stage={lead.stage} size="sm" />
                  <Link href={`/leads/${lead.id}`} target="_blank">
                    <Button variant="ghost" size="xs">View</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={onContinue}>
              Create Anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

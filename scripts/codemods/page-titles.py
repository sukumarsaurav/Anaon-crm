#!/usr/bin/env python3
"""Adds `export const metadata = { title }` to server pages that have none.

Every tab, bookmark and history entry used to read "ANON INDIA CRM". The root layout supplies the
"%s · ANON CRM" template; this sets the %s. Idempotent and dry-run by default:
    python3 scripts/codemods/page-titles.py          # show what would change
    python3 scripts/codemods/page-titles.py --write  # apply
Client pages ('use client') can't export metadata and are skipped. Pages that set a dynamic title
use generateMetadata by hand and are skipped too.
"""
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / 'src' / 'app'

TITLES = {
    '(auth)/login': None,  # client page; title comes from the (auth) layout
    '(broker-portal)/broker-portal': 'Partner Dashboard',
    '(broker-portal)/broker-portal/commissions': 'My Commissions',
    '(broker-portal)/broker-portal/inventory': 'Available Inventory',
    '(broker-portal)/broker-portal/leads': 'My Leads',
    '(client-portal)/client-portal': 'My Property',
    '(client-portal)/client-portal/complaints': 'Complaints & Requests',
    '(client-portal)/client-portal/construction': 'Construction Progress',
    '(client-portal)/client-portal/documents': 'My Documents',
    '(client-portal)/client-portal/payments': 'My Payments',
    '(client-portal)/client-portal/support': 'Support',
    '(client-portal-public)/client-portal/login': 'Client Login',
    '(dashboard)/admin/security': 'Security Admin',
    '(dashboard)/albums': 'Property Albums',
    '(dashboard)/audit-logs': 'Audit Log',
    '(dashboard)/automation': 'Automations',
    '(dashboard)/automation/[id]': 'Automation',
    '(dashboard)/automation/new': 'New Automation',
    '(dashboard)/automation/templates': 'Automation Templates',
    '(dashboard)/bookings': 'Bookings',
    '(dashboard)/bookings/[id]/allotment-letter': 'Allotment Letter',
    '(dashboard)/bookings/[id]/cancel': 'Cancel Booking',
    '(dashboard)/bookings/[id]/demand-letter/[paymentId]': 'Demand Letter',
    '(dashboard)/bookings/new': 'New Booking',
    '(dashboard)/brokers': 'Channel Partners',
    '(dashboard)/brokers/[id]': 'Channel Partner',
    '(dashboard)/brokers/[id]/edit': 'Edit Channel Partner',
    '(dashboard)/brokers/commissions': 'Commissions',
    '(dashboard)/brokers/new': 'Add Channel Partner',
    '(dashboard)/clients': 'Clients',
    '(dashboard)/clients/[id]/bookings/[bookingId]/payments': 'Payment Schedule',
    '(dashboard)/clients/[id]/edit': 'Edit Client',
    '(dashboard)/clients/extension-requests': 'Extension Requests',
    '(dashboard)/clients/new': 'New Client',
    '(dashboard)/construction': 'Construction',
    '(dashboard)/dashboard': 'Dashboard',
    '(dashboard)/hr': 'HR & Hiring',
    '(dashboard)/hr/attendance': 'Attendance',
    '(dashboard)/hr/employees': 'Employees',
    '(dashboard)/hr/employees/[id]': 'Employee',
    '(dashboard)/hr/leaves': 'Leave Requests',
    '(dashboard)/hr/payroll': 'Payroll',
    '(dashboard)/hr/recruitment': 'Recruitment',
    '(dashboard)/inventory': 'Inventory',
    '(dashboard)/inventory/[id]/construction': 'Construction Progress',
    '(dashboard)/inventory/[id]/edit': 'Edit Project',
    '(dashboard)/inventory/[id]/plots/[plotId]/cost-sheet': 'Cost Sheet',
    '(dashboard)/inventory/[id]/plots/[plotId]/edit': 'Edit Plot',
    '(dashboard)/inventory/[id]/plots/new': 'Add Plots',
    '(dashboard)/inventory/new': 'New Project',
    '(dashboard)/leads': 'Leads',
    '(dashboard)/leads/[id]/edit': 'Edit Lead',
    '(dashboard)/leads/import': 'Import Leads',
    '(dashboard)/leads/new': 'New Lead',
    '(dashboard)/leads/overdue': 'Overdue Follow-ups',
    '(dashboard)/legal': 'Legal & Compliance',
    '(dashboard)/legal/[projectId]': 'Project Compliance',
    '(dashboard)/legal/documents': 'Legal Templates',
    '(dashboard)/legal/privacy': 'Data Privacy',
    '(dashboard)/loans': 'Loans',
    '(dashboard)/loans/[loanId]': 'Loan Application',
    '(dashboard)/loans/banks': 'Bank Tie-ups',
    '(dashboard)/loans/dsas': 'DSAs',
    '(dashboard)/loans/new': 'New Loan Application',
    '(dashboard)/marketing': 'Marketing ROI',
    '(dashboard)/mobile': 'Field Activity',
    '(dashboard)/reports': 'Reports',
    '(dashboard)/reports/financial': 'Financial Report',
    '(dashboard)/reports/inventory': 'Inventory Report',
    '(dashboard)/reports/leads': 'Lead Report',
    '(dashboard)/reports/pipeline': 'Pipeline Report',
    '(dashboard)/reports/sales': 'Sales Report',
    '(dashboard)/settings': 'Settings',
    '(dashboard)/settings/assignment': 'Assignment Rules',
    '(dashboard)/settings/integrations': 'Integrations',
    '(dashboard)/settings/security': 'Security Settings',
    '(dashboard)/team': 'Sales Team',
    '(dashboard)/team/[id]': 'Team Member',
    '(dashboard)/team/[id]/performance': 'Performance',
    '(dashboard)/team/attendance': 'My Attendance',
    '(dashboard)/team/teams': 'Teams',
    '(dashboard)/whatsapp/auto-reply': 'Auto-Reply Rules',
    '(dashboard)/whatsapp/broadcasts': 'Broadcasts',
    '(dashboard)/whatsapp/broadcasts/[id]': 'Broadcast',
    '(dashboard)/whatsapp/broadcasts/new': 'New Broadcast',
    '(dashboard)/whatsapp/inbox': 'WhatsApp Inbox',
    '(dashboard)/whatsapp/templates': 'Message Templates',
    '(dashboard)/whatsapp/templates/new': 'New Template',
    'share/[token]': None,  # public album page sets its own title from the project
}

IMPORT_END = re.compile(r"^(?:import .* from ['\"][^'\"]+['\"];?|\} from ['\"][^'\"]+['\"];?|import ['\"][^'\"]+['\"];?)\s*$")


def main(write: bool) -> int:
    changed = 0
    for route, title in TITLES.items():
        if title is None:
            continue
        page = APP / route / 'page.tsx'
        if not page.exists():
            print(f'missing  {route}')
            continue
        src = page.read_text()
        if re.search(r"^['\"]use client['\"]", src, re.M):
            print(f'client   {route} (skipped)')
            continue
        if re.search(r'export (const metadata|async function generateMetadata|function generateMetadata)', src):
            continue
        lines = src.split('\n')
        last_import = max((i for i, l in enumerate(lines) if IMPORT_END.match(l)), default=-1)
        line = f"export const metadata = {{ title: {title!r} }}".replace("'", "'")
        at = last_import + 1
        lines[at:at] = ['', line] if last_import >= 0 else [line, '']
        changed += 1
        print(f'title    {route} -> {title}')
        if write:
            page.write_text('\n'.join(lines))
    print(f'\n{changed} page(s) {"updated" if write else "would change (dry run)"}')
    return 0


if __name__ == '__main__':
    sys.exit(main('--write' in sys.argv))

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getBookingReport, getCollectionReport, getOutstandingReport,
  getAdvisorScorecard, getSourcePerformance, getInventoryAvailability,
  getPlotAgeing, getBrokerCommissions,
} from '@/lib/reports/queries'

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ]
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type')
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let csv = ''
  let filename = 'report.csv'

  switch (type) {
    case 'bookings': {
      const data = await getBookingReport(from, to)
      const rows = data.map((b: any) => ({
        'Booking Number': b.booking_number,
        'Date': b.booking_date,
        'Client': b.client?.full_name,
        'Phone': b.client?.phone,
        'Project': b.project?.name,
        'Plot': b.plot?.plot_number,
        'Advisor': b.advisor?.full_name,
        'Value (₹)': b.total_sale_value,
        'Status': b.status,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = `bookings-${from ?? 'all'}-${to ?? 'all'}.csv`
      break
    }
    case 'collections': {
      const { payments } = await getCollectionReport(from, to)
      const rows = payments.map((p: any) => ({
        'Date': p.paid_date,
        'Client': p.client?.full_name,
        'Project': p.booking?.project?.name,
        'Booking': p.booking?.booking_number,
        'Amount (₹)': p.amount_paid,
        'Mode': p.mode,
        'Transaction': p.transaction_id,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = `collections-${from ?? 'all'}-${to ?? 'all'}.csv`
      break
    }
    case 'outstanding': {
      const { payments } = await getOutstandingReport()
      const rows = payments.map((p: any) => ({
        'Client': p.client?.full_name,
        'Phone': p.client?.phone,
        'Project': p.booking?.project?.name,
        'Booking': p.booking?.booking_number,
        'Due Date': p.due_date,
        'Amount Due (₹)': p.amount_due,
        'Days Overdue': p.daysOverdue || 0,
        'Status': p.status,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = 'outstanding-payments.csv'
      break
    }
    case 'advisor_scorecard': {
      const data = await getAdvisorScorecard(from, to)
      const rows = data.map((a: any) => ({
        'Name': a.name,
        'Designation': a.designation,
        'Leads Assigned': a.leads,
        'Calls': a.calls,
        'Follow-ups': a.followUps,
        'Site Visits': a.visits,
        'Bookings': a.bookings,
        'Revenue (₹)': a.revenue,
        'Target Bookings': a.targetBookings,
        'Target Revenue (₹)': a.targetRevenue,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = `advisor-scorecard-${from ?? 'all'}.csv`
      break
    }
    case 'source_performance': {
      const data = await getSourcePerformance(from, to)
      const rows = data.map(s => ({
        'Source': s.source,
        'Leads': s.leads,
        'Site Visits': s.visits,
        'Bookings': s.bookings,
        'Revenue (₹)': s.revenue,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = 'source-performance.csv'
      break
    }
    case 'inventory': {
      const data = await getInventoryAvailability()
      const rows = data.map(p => ({
        'Project': p.project,
        'City': p.city,
        'Total': p.total,
        'Available': p.available,
        'Held': p.held,
        'Booked': p.booked,
        'Sold': p.sold,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = 'inventory-availability.csv'
      break
    }
    case 'plot_ageing': {
      const data = await getPlotAgeing()
      const rows = data.map((p: any) => ({
        'Plot': p.plot_number,
        'Project': p.project?.name,
        'Status': p.status,
        'Days Available': p.daysAvailable,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = 'plot-ageing.csv'
      break
    }
    case 'broker_commissions': {
      const { commissions } = await getBrokerCommissions(from, to)
      const rows = (commissions as any[]).map(c => ({
        'Broker': c.broker?.name,
        'Phone': c.broker?.phone,
        'Booking': c.booking?.booking_number,
        'Project': c.booking?.project?.name,
        'Amount (₹)': c.amount,
        'Status': c.status,
      }))
      csv = toCSV(rows, Object.keys(rows[0] ?? {}))
      filename = 'broker-commissions.csv'
      break
    }
    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

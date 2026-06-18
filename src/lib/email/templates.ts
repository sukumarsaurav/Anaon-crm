/** Branded HTML email templates for ANON INDIA. */

const BRAND = '#1e293b'
const GOLD = '#a87e26'

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:${BRAND};padding:20px 28px">
          <span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px">ANON INDIA</span>
          <div style="color:#cbd5e1;font-size:11px;margin-top:2px">Real Estate · Jaipur</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="font-size:18px;margin:0 0 16px;color:${BRAND}">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">
          This is an automated message from ANON INDIA. Please do not reply directly.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:45%">${label}</td>
  <td style="padding:6px 0;font-size:13px;font-weight:bold">${value}</td></tr>`
}

function button(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:bold;margin-top:12px">${text}</a>`
}

export interface ReceiptEmailVars {
  name: string; bookingNumber: string; installment: number
  amount: string; date: string; reference: string
}
export function receiptEmail(v: ReceiptEmailVars) {
  return {
    subject: `Payment Receipt · ${v.bookingNumber} · Installment #${v.installment}`,
    html: layout('Payment Received', `
      <p style="font-size:14px;line-height:1.6">Dear ${v.name}, we have received your payment. The receipt is attached as a PDF.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0">
        ${row('Booking', v.bookingNumber)}
        ${row('Installment', `#${v.installment}`)}
        ${row('Amount', v.amount)}
        ${row('Date', v.date)}
        ${row('Reference', v.reference)}
      </table>
      <p style="font-size:13px;color:#64748b">Thank you for choosing ANON INDIA.</p>`),
  }
}

export interface DemandEmailVars {
  name: string; bookingNumber: string; installment: number
  amount: string; dueDate: string; portalUrl?: string
}
export function demandEmail(v: DemandEmailVars) {
  return {
    subject: `Payment Due · ${v.bookingNumber} · Installment #${v.installment}`,
    html: layout('Payment Demand Notice', `
      <p style="font-size:14px;line-height:1.6">Dear ${v.name}, the following installment is now due. The demand letter is attached.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0">
        ${row('Booking', v.bookingNumber)}
        ${row('Installment', `#${v.installment}`)}
        ${row('Amount Due', v.amount)}
        ${row('Due Date', v.dueDate)}
      </table>
      ${v.portalUrl ? button(v.portalUrl, 'Pay Online') : ''}`),
  }
}

export interface BookingEmailVars {
  name: string; bookingNumber: string; project: string; unit: string; totalValue: string
}
export function bookingConfirmationEmail(v: BookingEmailVars) {
  return {
    subject: `Booking Confirmed · ${v.bookingNumber}`,
    html: layout('Your Booking is Confirmed', `
      <p style="font-size:14px;line-height:1.6">Dear ${v.name}, congratulations! Your booking with ANON INDIA is confirmed.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0">
        ${row('Booking', v.bookingNumber)}
        ${row('Project', v.project)}
        ${row('Unit', v.unit)}
        ${row('Total Value', v.totalValue)}
      </table>
      <p style="font-size:13px;color:#64748b">Your allotment letter and payment schedule are available in your Client Portal.</p>`),
  }
}

export interface KycEmailVars { name: string; status: string }
export function kycStatusEmail(v: KycEmailVars) {
  return {
    subject: `KYC ${v.status} · ANON INDIA`,
    html: layout('KYC Status Update', `
      <p style="font-size:14px;line-height:1.6">Dear ${v.name}, your KYC status has been updated to
      <strong>${v.status}</strong>.</p>
      <p style="font-size:13px;color:#64748b">If any action is required, our team will contact you.</p>`),
  }
}

/** Generic body for the automation engine's send_email action. */
export function genericEmail(subject: string, message: string) {
  return { subject, html: layout(subject, `<p style="font-size:14px;line-height:1.6;white-space:pre-line">${message}</p>`) }
}

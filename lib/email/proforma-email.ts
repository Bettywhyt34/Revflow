export interface ProformaEmailData {
  documentNumber: string
  issueDate: string      // ISO date
  validUntil: string     // ISO date
  dueDate: string        // ISO date
  recipientName: string
  campaignTitle: string
  trackerID: string
  recognitionStart: string  // ISO date
  recognitionEnd: string    // ISO date
  amountBeforeVat: number
  includeAgencyFee: boolean
  agencyFeePct: number
  agencyFeeAmount: number
  vatAmount: number
  totalAmount: number
  currency: string
  notes?: string | null
  messageBody?: string | null
  bankName?: string | null
  accountName?: string | null
  accountNumber?: string | null
  bankCode?: string | null
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function row(label: string, value: string, bold = false): string {
  const style = bold
    ? 'font-weight:700;font-size:15px;color:#111827;border-top:2px solid #0D9488;'
    : 'color:#374151;'
  return `
    <tr>
      <td style="padding:8px 0;${style}">${label}</td>
      <td style="padding:8px 0;text-align:right;${style}">${value}</td>
    </tr>`
}

export function buildProformaEmailHtml(d: ProformaEmailData): string {
  const agencyRow = d.includeAgencyFee
    ? row(`Agency Commission (${d.agencyFeePct}%)`, fmt(d.agencyFeeAmount, d.currency))
    : ''

  const messageBlock = d.messageBody
    ? `<div style="margin-bottom:24px;padding:16px 20px;background:#F0FDFA;border-radius:8px;border:1px solid #99F6E4;">
        <p style="margin:0;font-size:14px;color:#065F46;white-space:pre-wrap;line-height:1.6;">${d.messageBody}</p>
       </div>
       <hr style="border:none;border-top:1px solid #E5E7EB;margin-bottom:24px;" />`
    : ''

  const notesBlock = d.notes
    ? `<p style="font-size:13px;color:#6B7280;margin-top:24px;padding:12px 16px;background:#F9FAFB;border-left:3px solid #0D9488;border-radius:4px;">
        <strong>Notes:</strong> ${d.notes}
       </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:640px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0D9488 0%,#065F59 100%);padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">QVT MEDIA</div>
                <div style="font-size:12px;color:#99F6E4;margin-top:2px;">Campaign Billing. Done Right.</div>
                <div style="font-size:11px;color:#99F6E4;margin-top:6px;">
                  Lagos, Nigeria &nbsp;|&nbsp; billing@revflowapp.com
                </div>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <div style="font-size:20px;font-weight:700;color:#ffffff;">PROFORMA INVOICE</div>
                <div style="font-size:13px;color:#CCFBF1;margin-top:6px;">
                  <strong style="color:#ffffff;">${d.documentNumber}</strong>
                </div>
                <div style="font-size:12px;color:#99F6E4;margin-top:4px;">
                  Date: ${fmtDate(d.issueDate)}<br>
                  Valid Until: ${fmtDate(d.validUntil)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 40px;">

          ${messageBlock}

          <!-- Bill To + Recognition Period -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="vertical-align:top;width:50%;">
                <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">BILL TO</div>
                <div style="font-size:14px;font-weight:700;color:#111827;">${d.recipientName}</div>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">RECOGNITION PERIOD</div>
                <div style="font-size:13px;font-weight:600;color:#0D9488;">${fmtDate(d.recognitionStart)} – ${fmtDate(d.recognitionEnd)}</div>
              </td>
            </tr>
          </table>

          <!-- Campaign ref -->
          <div style="font-size:12px;color:#6B7280;margin-bottom:6px;">RE: Ref ${d.trackerID}</div>
          <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:24px;">${d.campaignTitle}</div>

          <!-- Line items table -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border-collapse:collapse;margin-bottom:4px;">
            <thead>
              <tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB;">
                <th style="padding:10px 0;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">#</th>
                <th style="padding:10px 0;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                <th style="padding:10px 0;text-align:right;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #F3F4F6;">
                <td style="padding:12px 0;font-size:13px;color:#374151;width:24px;">1</td>
                <td style="padding:12px 0;font-size:13px;color:#374151;">
                  ${d.campaignTitle}<br>
                  <span style="font-size:11px;color:#9CA3AF;">Recognition: ${fmtDate(d.recognitionStart)} – ${fmtDate(d.recognitionEnd)}</span>
                </td>
                <td style="padding:12px 0;font-size:13px;color:#374151;text-align:right;">${fmt(d.amountBeforeVat, d.currency)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border-collapse:collapse;margin-top:4px;margin-left:auto;max-width:320px;">
            <tbody>
              ${row('Subtotal', fmt(d.amountBeforeVat, d.currency))}
              ${agencyRow}
              ${row('VAT @ 7.5%', fmt(d.vatAmount, d.currency))}
              ${row('TOTAL DUE', fmt(d.totalAmount, d.currency), true)}
            </tbody>
          </table>

          <!-- Due date callout -->
          <div style="margin-top:24px;padding:14px 20px;background:#F0FDFA;border:1px solid #99F6E4;border-radius:8px;">
            <span style="font-size:13px;color:#065F46;font-weight:600;">Payment due by ${fmtDate(d.dueDate)}</span>
            <span style="font-size:12px;color:#047857;margin-left:8px;">(30 days from invoice date)</span>
          </div>

          ${notesBlock}

          <!-- Bank details -->
          <div style="margin-top:28px;padding:16px 20px;background:#F9FAFB;border-radius:8px;">
            <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">PAYMENT DETAILS</div>
            ${d.bankName
              ? `<table cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
              <tr><td style="padding:2px 0;color:#9CA3AF;width:140px;">Bank</td><td style="padding:2px 0;font-weight:600;">${d.bankName}</td></tr>
              <tr><td style="padding:2px 0;color:#9CA3AF;">Account Name</td><td style="padding:2px 0;font-weight:600;">${d.accountName ?? ''}</td></tr>
              <tr><td style="padding:2px 0;color:#9CA3AF;">Account Number</td><td style="padding:2px 0;font-weight:600;">${d.accountNumber ?? ''}</td></tr>
              ${d.bankCode ? `<tr><td style="padding:2px 0;color:#9CA3AF;">Sort Code</td><td style="padding:2px 0;font-weight:600;">${d.bankCode}</td></tr>` : ''}
            </table>`
              : `<p style="margin:0;font-size:13px;color:#6B7280;">Contact billing@revflowapp.com for payment details.</p>`
            }
          </div>

          <!-- Footer note -->
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #E5E7EB;">
            <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">
              This is a proforma invoice. Payment constitutes acceptance of the booking.
            </p>
            <p style="font-size:12px;color:#9CA3AF;margin:0;">
              For enquiries: billing@revflowapp.com
            </p>
          </div>

        </td>
      </tr>

      <!-- Footer bar -->
      <tr>
        <td style="background:#F9FAFB;padding:16px 40px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">
            QVT Media Limited &nbsp;•&nbsp; Lagos, Nigeria &nbsp;•&nbsp;
            <a href="https://revflowapp.com" style="color:#0D9488;text-decoration:none;">revflowapp.com</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

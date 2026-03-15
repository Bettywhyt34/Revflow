import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface HtmlLineItem {
  qty: number
  description: string
  unitPrice: number
  lineTotal: number
}

export interface ProformaHTMLPreviewProps {
  orgName: string
  orgLogoUrl: string | null
  primaryColor: string
  documentTitle?: string      // defaults to "PROFORMA INVOICE"
  invoiceNumber: string
  issueDate: string           // pre-formatted, e.g. "15/03/2026"
  recipientName: string
  recipientAddress: string | null
  customerId: string
  invoiceSubject: string
  currency: string
  lineItems: HtmlLineItem[]
  vatAmount: number
  totalAmount: number
  amountInWords: string
  notes: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ProformaHTMLPreview({
  orgName,
  orgLogoUrl,
  primaryColor: pc,
  documentTitle = 'PROFORMA INVOICE',
  invoiceNumber,
  issueDate,
  recipientName,
  recipientAddress,
  customerId,
  invoiceSubject,
  currency,
  lineItems,
  vatAmount,
  totalAmount,
  amountInWords,
  notes,
}: ProformaHTMLPreviewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs font-sans select-none">

      {/* ── Header ── */}
      <div className="px-8 pt-7 pb-3 flex justify-between items-start gap-4">
        <div>
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgLogoUrl} alt={orgName} className="h-14 max-w-[150px] object-contain" />
          ) : (
            <span className="text-2xl font-extrabold leading-none" style={{ color: pc }}>
              {orgName}
            </span>
          )}
        </div>
        <div className="text-right pt-1">
          <div className="text-xl font-extrabold leading-tight" style={{ color: '#1a1a4e' }}>
            {documentTitle}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <hr className="mx-8 mb-5" style={{ borderColor: pc, borderTopWidth: 3 }} />

      {/* ── Meta: LEFT stacked DATE/INVOICE#/CUSTOMER ID | RIGHT TO ── */}
      <div className="px-8 pb-6 flex justify-between gap-6">
        <div className="flex-1 flex flex-col gap-[9px]">
          {(
            [
              ['DATE', issueDate || '—'],
              ['INVOICE #', invoiceNumber || '(on save)'],
              ['CUSTOMER ID', customerId],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <div className="font-bold text-[9px] uppercase mb-0.5" style={{ color: pc }}>
                {label}
              </div>
              <div className="font-bold text-gray-900 text-[11px]">{value}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 text-right">
          <div className="font-bold text-[9px] uppercase mb-0.5" style={{ color: pc }}>TO</div>
          <div className="font-bold text-gray-900 text-[11px]">{recipientName || '—'}</div>
          {recipientAddress && (
            <div className="text-gray-500 mt-1 whitespace-pre-line max-w-[180px] ml-auto text-right text-[10px]">
              {recipientAddress}
            </div>
          )}
        </div>
      </div>

      {/* ── Subject ── */}
      <div className="px-8 pb-4">
        <div className="font-bold text-[9px] uppercase mb-1.5" style={{ color: pc }}>SUBJECT:</div>
        <div className="border px-3 py-2 text-[11px] text-gray-800" style={{ borderColor: pc }}>
          {invoiceSubject || (
            <span className="text-gray-400 italic">No subject</span>
          )}
        </div>
      </div>

      {/* ── Line items table ── */}
      <div className="px-8 pb-3 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ backgroundColor: pc }}>
              <th className="py-2 px-2 text-white font-bold uppercase text-left w-[8%]">QTY</th>
              <th className="py-2 px-2 text-white font-bold uppercase text-left w-[47%]">DESCRIPTION</th>
              <th className="py-2 px-2 text-white font-bold uppercase text-right w-[23%]">UNIT PRICE</th>
              <th className="py-2 px-2 text-white font-bold uppercase text-right w-[22%]">LINE TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-200" style={{ height: 22 }}>
                <td className="py-1.5 px-2 text-gray-700">{item.qty > 0 ? item.qty : ''}</td>
                <td className="py-1.5 px-2 text-gray-800">{item.description}</td>
                <td className="py-1.5 px-2 text-right text-gray-800">
                  {item.unitPrice > 0 ? fmt(item.unitPrice, currency) : ''}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-800">
                  {item.lineTotal > 0 ? fmt(item.lineTotal, currency) : ''}
                </td>
              </tr>
            ))}
            {/* VAT row */}
            <tr className="border-b border-gray-200" style={{ height: 22 }}>
              <td className="py-1.5 px-2"></td>
              <td className="py-1.5 px-2 text-gray-800">Vat@ 7.5%</td>
              <td className="py-1.5 px-2"></td>
              <td className="py-1.5 px-2 text-right text-gray-800">
                {vatAmount > 0 ? fmt(vatAmount, currency) : ''}
              </td>
            </tr>
            {/* Empty rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-gray-200" style={{ height: 22 }}>
                <td className="px-2"></td>
                <td className="px-2"></td>
                <td className="px-2"></td>
                <td className="px-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTAL ── */}
      <div className="px-8 pb-4 flex justify-end items-center gap-3">
        <span className="font-bold text-sm" style={{ color: pc }}>TOTAL</span>
        <div
          className="border-2 px-4 py-1.5 font-bold text-sm text-gray-900"
          style={{ borderColor: pc }}
        >
          {fmt(totalAmount, currency)}
        </div>
      </div>

      {/* ── Amount in words ── */}
      <div className="px-8 pb-5 flex gap-2 flex-wrap text-[10px]">
        <span className="font-bold shrink-0" style={{ color: pc }}>AMOUNT IN WORDS:</span>
        <span className="text-gray-800 leading-relaxed">{amountInWords}</span>
      </div>

      {/* ── Footer ── */}
      <div className="mx-8 mb-6 border-t border-gray-100 pt-4 space-y-2">
        <div className="text-center font-bold text-[11px]" style={{ color: pc }}>
          THANK YOU FOR YOUR BUSINESS
        </div>
        <div className="text-center text-[10px] text-gray-500">
          {notes
            ? `NOTE: ${notes}`
            : `NOTE: All cheques should be in favor of ${orgName}`}
        </div>
      </div>

    </div>
  )
}

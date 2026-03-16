import React from 'react'
import type { DocumentTemplateData } from './template-types'

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Template 3 — Bold Corporate ─────────────────────────────────────────────

export default function TemplateT3HTML({ data }: { data: DocumentTemplateData }) {
  const pc = data.primaryColor
  const isInvoice = data.documentType === 'invoice'
  const balanceDue = data.balanceDue ?? data.totalAmount
  const amountInWords = data.amountInWords ?? '—'

  const invoiceDetailFields = isInvoice
    ? ([
        ['DATE', data.issueDate],
        ['TERMS', data.paymentTerms ?? 'Net 30'],
        ['DUE DATE', data.dueDate ?? '—'],
        data.poNumber ? ['PO NUMBER', data.poNumber] : null,
      ] as ([string, string] | null)[]).filter(Boolean) as [string, string][]
    : []

  const proformaDetailFields: [string, string][] = [
    ['DATE', data.issueDate],
    ['INVOICE #', data.invoiceNumber || '(on save)'],
    ['CUSTOMER ID', data.customerId],
  ]

  return (
    <div className="rounded-xl overflow-hidden text-xs font-sans select-none border border-gray-200">

      {/* ── Dark header ── */}
      <div
        className="px-8 py-6 flex justify-between items-start gap-4"
        style={{ backgroundColor: pc }}
      >
        <div>
          {data.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={data.logoUrl} alt={data.orgName} className="h-10 max-w-[120px] object-contain" />
            : <span className="text-lg font-extrabold text-white">{data.orgName}</span>
          }
        </div>
        <div className="text-right">
          <div className="text-xl font-bold uppercase tracking-wide text-white">
            {data.documentTitle}
          </div>
          <div className="text-white/70 text-[10px] mt-1">
            {data.invoiceNumber || '—'}
          </div>
          {isInvoice && balanceDue > 0 && (
            <>
              <div className="text-white/60 text-[9px] mt-2">Balance Due</div>
              <div className="text-white font-bold text-sm">{fmt(balanceDue, data.currency)}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-white px-8 pt-6 pb-6 space-y-4">

        {/* ── Two info cards ── */}
        <div className="grid grid-cols-2 gap-4">
          {isInvoice ? (
            <>
              {/* Left: Bill To */}
              <div className="border border-gray-200 rounded-lg p-3.5">
                <div className="text-[8px] font-bold text-gray-400 uppercase mb-2">BILL TO</div>
                <div className="font-bold text-gray-900 text-[11px]">{data.recipientName || '—'}</div>
                {data.recipientAddress && (
                  <div className="text-gray-500 text-[10px] mt-0.5 whitespace-pre-line">
                    {data.recipientAddress}
                  </div>
                )}
              </div>
              {/* Right: Invoice details */}
              <div className="border border-gray-200 rounded-lg p-3.5">
                <div className="text-[8px] font-bold text-gray-400 uppercase mb-2">INVOICE DETAILS</div>
                <div className="space-y-1.5">
                  {invoiceDetailFields.map(([label, value]) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-[8px] font-bold text-gray-400 w-16 shrink-0 uppercase">{label}</span>
                      <span className="text-[10px] text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Left: Invoice details */}
              <div className="border border-gray-200 rounded-lg p-3.5">
                <div className="text-[8px] font-bold text-gray-400 uppercase mb-2">INVOICE DETAILS</div>
                <div className="space-y-1.5">
                  {proformaDetailFields.map(([label, value]) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-[8px] font-bold text-gray-400 w-20 shrink-0 uppercase">{label}</span>
                      <span className="text-[10px] text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right: Bill To */}
              <div className="border border-gray-200 rounded-lg p-3.5">
                <div className="text-[8px] font-bold text-gray-400 uppercase mb-2">BILL TO</div>
                <div className="font-bold text-gray-900 text-[11px]">{data.recipientName || '—'}</div>
                {data.recipientAddress && (
                  <div className="text-gray-500 text-[10px] mt-0.5 whitespace-pre-line">
                    {data.recipientAddress}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Subject with left border accent ── */}
        <div
          className="py-2 pl-3 pr-2"
          style={{ borderLeft: `4px solid ${pc}` }}
        >
          <div className="text-[8px] font-bold text-gray-400 uppercase mb-1">SUBJECT</div>
          <div className="text-[10px] text-gray-700 leading-relaxed">
            {data.invoiceSubject || <span className="text-gray-400 italic">No subject</span>}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ backgroundColor: pc }}>
                {isInvoice ? (
                  <>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[6%]">#</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[46%]">ITEM & DESCRIPTION</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[10%]">QTY</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[18%]">RATE</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[20%]">AMOUNT</th>
                  </>
                ) : (
                  <>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[8%]">QTY</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[47%]">DESCRIPTION</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[23%]">UNIT PRICE</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[22%]">LINE TOTAL</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {isInvoice ? (
                    <>
                      <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 px-2 text-gray-800">{item.description}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">
                        {item.qty > 0 ? item.qty : ''}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.unitPrice > 0 ? fmt(item.unitPrice, data.currency) : ''}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.lineTotal > 0 ? fmt(item.lineTotal, data.currency) : ''}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 px-2 text-gray-700">{item.qty > 0 ? item.qty : ''}</td>
                      <td className="py-1.5 px-2 text-gray-800">{item.description}</td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.unitPrice > 0 ? fmt(item.unitPrice, data.currency) : ''}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.lineTotal > 0 ? fmt(item.lineTotal, data.currency) : ''}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {/* VAT row */}
              <tr className="border-b border-gray-100">
                {isInvoice ? (
                  <>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-gray-700">Vat@ 7.5%</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-right text-gray-800">
                      {data.vatAmount > 0 ? fmt(data.vatAmount, data.currency) : ''}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-gray-700">Vat@ 7.5%</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-right text-gray-800">
                      {data.vatAmount > 0 ? fmt(data.vatAmount, data.currency) : ''}
                    </td>
                  </>
                )}
              </tr>
              {/* Empty rows */}
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-100" style={{ height: 20 }}>
                  <td /><td /><td />{isInvoice && <td />}{isInvoice && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals (rounded box, right-aligned) ── */}
        <div className="flex justify-end">
          <div className="border border-gray-200 rounded-lg overflow-hidden w-56">
            <div className="flex justify-between px-4 py-2 border-b border-gray-100 text-[11px]">
              <span className="text-gray-500">Sub Total</span>
              <span className="tabular-nums text-gray-900">{fmt(data.subtotal, data.currency)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 border-b border-gray-100 text-[11px]">
              <span className="text-gray-500">VAT 7.5%</span>
              <span className="tabular-nums text-gray-900">{fmt(data.vatAmount, data.currency)}</span>
            </div>
            {isInvoice && (
              <div className="flex justify-between px-4 py-2 border-b border-gray-100 text-[11px]">
                <span className="text-gray-500">Total</span>
                <span className="tabular-nums text-gray-900">{fmt(data.totalAmount, data.currency)}</span>
              </div>
            )}
            {/* Total / Balance Due row — brand color bg */}
            <div
              className="flex justify-between px-4 py-2.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: pc }}
            >
              <span>{isInvoice ? 'BALANCE DUE' : 'TOTAL'}</span>
              <span className="tabular-nums">
                {fmt(isInvoice ? balanceDue : data.totalAmount, data.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Amount in words ── */}
        <div className="flex gap-2 flex-wrap text-[10px]">
          <span className="font-bold uppercase shrink-0" style={{ color: pc }}>
            AMOUNT IN WORDS:
          </span>
          <span className="text-gray-600">{amountInWords}</span>
        </div>

        {/* ── Notes (invoice) ── */}
        {isInvoice && data.notes && (
          <div>
            <div className="text-[8px] font-bold uppercase mb-1 text-gray-400">NOTES</div>
            <div className="text-[10px] text-gray-600">{data.notes}</div>
          </div>
        )}

      </div>

      {/* ── Footer brand color strip ── */}
      <div
        className="px-8 py-4 text-center"
        style={{ backgroundColor: pc }}
      >
        <div className="font-bold text-white text-[11px] mb-1">
          THANK YOU FOR YOUR BUSINESS
        </div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {!isInvoice && data.notes
            ? `NOTE: ${data.notes}`
            : `NOTE: All cheques should be in favor of ${data.orgName}`}
        </div>
      </div>

    </div>
  )
}

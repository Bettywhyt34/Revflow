import React from 'react'
import type { DocumentTemplateData } from './template-types'

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Template 2 — Modern Minimal ─────────────────────────────────────────────

export default function TemplateT2HTML({ data }: { data: DocumentTemplateData }) {
  const pc = data.primaryColor
  const isInvoice = data.documentType === 'invoice'
  const balanceDue = data.balanceDue ?? data.totalAmount
  const amountInWords = data.amountInWords ?? '—'

  const infoFields = isInvoice
    ? ([
        ['INVOICE DATE', data.issueDate],
        ['TERMS', data.paymentTerms ?? 'Net 30'],
        ['DUE DATE', data.dueDate ?? '—'],
        data.poNumber ? ['PO NUMBER', data.poNumber] : null,
      ] as ([string, string] | null)[]).filter(Boolean) as [string, string][]
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs font-sans select-none">

      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-3 flex justify-between items-start gap-4">
        <div>
          {data.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={data.logoUrl} alt={data.orgName} className="h-10 max-w-[120px] object-contain" />
            : <span className="text-lg font-extrabold leading-none" style={{ color: pc }}>{data.orgName}</span>
          }
        </div>
        <div className="text-right">
          <div
            className="text-lg font-light uppercase tracking-[0.18em] text-gray-900"
          >
            {data.documentTitle}
          </div>
          {isInvoice && balanceDue > 0 && (
            <>
              <div className="text-[9px] text-gray-400 mt-1">Balance Due</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: pc }}>
                {fmt(balanceDue, data.currency)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Accent line ── */}
      <div className="mx-8 mb-3" style={{ height: '1.5px', backgroundColor: pc }} />

      {/* ── Info section ── */}
      {isInvoice ? (
        // Invoice: two columns (Bill To | Date/Terms/Due)
        <div className="px-8 mb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[8px] font-bold uppercase mb-1.5" style={{ color: pc }}>
              BILL TO
            </div>
            <div className="font-bold text-gray-900 text-[11px]">{data.recipientName || '—'}</div>
            {data.recipientAddress && (
              <div className="text-gray-500 text-[10px] mt-0.5 whitespace-pre-line">
                {data.recipientAddress}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {infoFields!.map(([label, value]) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-[8px] font-bold text-gray-400 w-20 shrink-0 uppercase">{label}</span>
                <span className="text-[10px] text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Proforma: 3-col info band + TO section
        <>
          <div className="mx-8 mb-3 px-4 py-3 bg-gray-100 rounded grid grid-cols-3 gap-3">
            {(
              [
                ['DATE', data.issueDate || '—'],
                ['INVOICE #', data.invoiceNumber || '(on save)'],
                ['CUSTOMER ID', data.customerId],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-[8px] font-bold text-gray-400 uppercase mb-1">{label}</div>
                <div className="font-bold text-gray-900 text-[10px]">{value}</div>
              </div>
            ))}
          </div>
          <div className="px-8 mb-3">
            <div className="text-[8px] font-bold uppercase mb-1" style={{ color: pc }}>TO:</div>
            <div className="font-bold text-gray-900 text-[11px]">{data.recipientName || '—'}</div>
            {data.recipientAddress && (
              <div className="text-gray-500 text-[10px] mt-0.5 whitespace-pre-line">
                {data.recipientAddress}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Subject ── */}
      <div className="px-8 pb-3 flex items-start gap-2">
        <span className="text-[8px] font-bold uppercase shrink-0 mt-0.5" style={{ color: pc }}>
          SUBJECT:
        </span>
        <span className="text-[10px] text-gray-700 leading-relaxed">
          {data.invoiceSubject || <span className="text-gray-400 italic">No subject</span>}
        </span>
      </div>

      {/* ── Line items table ── */}
      <div className="px-8 pb-3 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${pc}` }}>
              {isInvoice ? (
                <>
                  <th className="pb-2 px-1 font-bold uppercase text-left text-[8px] w-[6%]" style={{ color: pc }}>#</th>
                  <th className="pb-2 px-1 font-bold uppercase text-left text-[8px] w-[46%]" style={{ color: pc }}>ITEM & DESCRIPTION</th>
                  <th className="pb-2 px-1 font-bold uppercase text-right text-[8px] w-[10%]" style={{ color: pc }}>QTY</th>
                  <th className="pb-2 px-1 font-bold uppercase text-right text-[8px] w-[18%]" style={{ color: pc }}>RATE</th>
                  <th className="pb-2 px-1 font-bold uppercase text-right text-[8px] w-[20%]" style={{ color: pc }}>AMOUNT</th>
                </>
              ) : (
                <>
                  <th className="pb-2 px-1 font-bold uppercase text-left text-[8px] w-[8%]" style={{ color: pc }}>QTY</th>
                  <th className="pb-2 px-1 font-bold uppercase text-left text-[8px] w-[47%]" style={{ color: pc }}>DESCRIPTION</th>
                  <th className="pb-2 px-1 font-bold uppercase text-right text-[8px] w-[23%]" style={{ color: pc }}>UNIT PRICE</th>
                  <th className="pb-2 px-1 font-bold uppercase text-right text-[8px] w-[22%]" style={{ color: pc }}>LINE TOTAL</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr
                key={i}
                className="border-b border-gray-100"
                style={i % 2 === 1 ? { backgroundColor: '#fafafa', minHeight: 22 } : { minHeight: 22 }}
              >
                {isInvoice ? (
                  <>
                    <td className="py-1.5 px-1 text-gray-500">{i + 1}</td>
                    <td className="py-1.5 px-1 text-gray-800">{item.description}</td>
                    <td className="py-1.5 px-1 text-right text-gray-700">
                      {item.qty > 0 ? item.qty : ''}
                    </td>
                    <td className="py-1.5 px-1 text-right text-gray-800">
                      {item.unitPrice > 0 ? fmt(item.unitPrice, data.currency) : ''}
                    </td>
                    <td className="py-1.5 px-1 text-right text-gray-800">
                      {item.lineTotal > 0 ? fmt(item.lineTotal, data.currency) : ''}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 px-1 text-gray-700">{item.qty > 0 ? item.qty : ''}</td>
                    <td className="py-1.5 px-1 text-gray-800">{item.description}</td>
                    <td className="py-1.5 px-1 text-right text-gray-800">
                      {item.unitPrice > 0 ? fmt(item.unitPrice, data.currency) : ''}
                    </td>
                    <td className="py-1.5 px-1 text-right text-gray-800">
                      {item.lineTotal > 0 ? fmt(item.lineTotal, data.currency) : ''}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {/* VAT row */}
            <tr
              className="border-b border-gray-100"
              style={data.lineItems.length % 2 === 1 ? { backgroundColor: '#fafafa' } : {}}
            >
              {isInvoice ? (
                <>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-gray-700">Vat@ 7.5%</td>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-right text-gray-800">
                    {data.vatAmount > 0 ? fmt(data.vatAmount, data.currency) : ''}
                  </td>
                </>
              ) : (
                <>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-gray-700">Vat@ 7.5%</td>
                  <td className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-right text-gray-800">
                    {data.vatAmount > 0 ? fmt(data.vatAmount, data.currency) : ''}
                  </td>
                </>
              )}
            </tr>
            {/* Empty rows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className="border-b border-gray-100"
                style={(data.lineItems.length + 1 + i) % 2 === 1 ? { backgroundColor: '#fafafa', height: 20 } : { height: 20 }}
              >
                <td /><td /><td />{isInvoice && <td />}{isInvoice && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals (right-aligned clean) ── */}
      <div className="px-8 pb-4 flex justify-end">
        <div className="w-52 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-gray-500">
            <span>Sub Total</span>
            <span className="tabular-nums">{fmt(data.subtotal, data.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>VAT 7.5%</span>
            <span className="tabular-nums">{fmt(data.vatAmount, data.currency)}</span>
          </div>
          <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold" style={{ color: pc }}>
            <span>TOTAL</span>
            <span className="tabular-nums">{fmt(data.totalAmount, data.currency)}</span>
          </div>
          {isInvoice && (
            <div className="flex justify-between font-bold" style={{ color: pc }}>
              <span>BALANCE DUE</span>
              <span className="tabular-nums">{fmt(balanceDue, data.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Amount in words ── */}
      <div className="px-8 pb-4 flex gap-2 flex-wrap text-[10px] text-gray-400 italic">
        <span className="font-semibold not-italic shrink-0">AMOUNT IN WORDS:</span>
        <span>{amountInWords}</span>
      </div>

      {/* ── Notes section (invoice) ── */}
      {isInvoice && data.notes && (
        <div className="px-8 pb-4">
          <div className="text-[8px] font-bold uppercase mb-1 text-gray-400">NOTES</div>
          <div className="text-[10px] text-gray-600">{data.notes}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mx-8 mb-6 border-t border-gray-100 pt-4 space-y-1.5 text-center">
        <div className="font-bold text-[11px]" style={{ color: pc }}>
          Thank you for your business
        </div>
        <div className="text-[10px] text-gray-400">
          {!isInvoice && data.notes
            ? `NOTE: ${data.notes}`
            : `NOTE: All cheques should be in favor of ${data.orgName}`}
        </div>
      </div>

    </div>
  )
}

/**
 * lib/pdf/bundle-merge.ts
 * Merges multiple documents (proforma, invoice, PO, plan, compliance, write-off)
 * into a single PDF using pdf-lib + @react-pdf/renderer.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface BundleItem {
  docId: string | null           // null for upload_record items
  type: string
  label: string
  filePath: string | null        // Supabase storage path (null = generated PDF)
  fileType: 'pdf' | 'excel' | 'generated'
  date: string | null
  docNumber: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchStorageBytes(
  filePath: string,
  supabase: SupabaseClient,
): Promise<Uint8Array | null> {
  const { data } = await supabase.storage
    .from('campaign-documents')
    .createSignedUrl(filePath, 3600)
  if (!data?.signedUrl) return null
  const res = await fetch(data.signedUrl)
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function renderExcelTableAsPdf(buffer: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    const nonEmpty = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).slice(0, 50)
    if (nonEmpty.length === 0) return null

    const React = await import('react')
    const { Document, Page, View, Text, StyleSheet, renderToBuffer } = await import('@react-pdf/renderer')

    const styles = StyleSheet.create({
      page: { fontFamily: 'Helvetica', fontSize: 7, padding: 30 },
      title: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#0D9488' },
      row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 2 },
      cell: { flex: 1, fontSize: 7, color: '#374151', paddingHorizontal: 2 },
      headerCell: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#111827', paddingHorizontal: 2 },
    })

    const element = React.createElement(
      Document,
      {},
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, 'Excel Attachment'),
        ...nonEmpty.map((row, ri) =>
          React.createElement(
            View,
            { key: String(ri), style: styles.row },
            ...(row as unknown[]).slice(0, 8).map((cell, ci) =>
              React.createElement(
                Text,
                { key: String(ci), style: ri === 0 ? styles.headerCell : styles.cell },
                String(cell ?? ''),
              ),
            ),
          ),
        ),
      ),
    )

    return await renderToBuffer(element as React.ReactElement<import('@react-pdf/renderer').DocumentProps>)
  } catch (err) {
    console.error('renderExcelTableAsPdf error:', err)
    return null
  }
}

async function generateSeparatorPage(label: string, docNumber: string, date: string | null): Promise<Uint8Array> {
  const React = await import('react')
  const { Document, Page, View, Text, StyleSheet, renderToBuffer } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      padding: 60,
      backgroundColor: '#F9FAFB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    box: {
      borderWidth: 2,
      borderColor: '#0D9488',
      borderRadius: 8,
      padding: 40,
      alignItems: 'center',
      minWidth: 300,
    },
    label: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: '#0D9488',
      marginBottom: 12,
      textAlign: 'center',
    },
    docNum: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      marginBottom: 6,
    },
    date: { fontSize: 9, color: '#6b7280' },
  })

  const element = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        { style: styles.box },
        React.createElement(Text, { style: styles.label }, label),
        React.createElement(Text, { style: styles.docNum }, docNumber),
        date
          ? React.createElement(
              Text,
              { style: styles.date },
              new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
            )
          : null,
      ),
    ),
  )

  return await renderToBuffer(element as React.ReactElement<import('@react-pdf/renderer').DocumentProps>)
}

function addPageNumbers(pdfDoc: PDFDocument, font: import('pdf-lib').PDFFont): void {
  const pages = pdfDoc.getPages()
  const total = pages.length
  for (let i = 0; i < total; i++) {
    const page = pages[i]
    const { width } = page.getSize()
    page.drawText(`Page ${i + 1} of ${total}`, {
      x: width / 2 - 30,
      y: 20,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    })
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function mergeDocumentsIntoPdf(
  items: BundleItem[],
  orgId: string,
  campaignId: string,
  supabase: SupabaseClient,
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  const font = await merged.embedFont(StandardFonts.Helvetica)

  for (const item of items) {
    let pdfBytes: Uint8Array | null = null

    if (item.fileType === 'generated' && item.docId) {
      // Generate proforma/invoice PDF via the existing PDF route
      try {
        const type = item.type === 'proforma_invoice' ? 'proforma' : 'invoice'
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const res = await fetch(`${baseUrl}/api/${type}/${item.docId}/pdf`, {
          headers: { 'x-internal-bundle': 'true' },
        })
        if (res.ok) {
          pdfBytes = new Uint8Array(await res.arrayBuffer())
        }
      } catch (err) {
        console.error(`Failed to generate PDF for ${item.type} ${item.docId}:`, err)
      }
    } else if (item.fileType === 'pdf' && item.filePath) {
      pdfBytes = await fetchStorageBytes(item.filePath, supabase)
    } else if (item.fileType === 'excel' && item.filePath) {
      const bytes = await fetchStorageBytes(item.filePath, supabase)
      if (bytes) {
        pdfBytes = await renderExcelTableAsPdf(bytes.buffer as ArrayBuffer)
      }
    } else if (item.type === 'write_off_summary') {
      // Write-off summary is generated inline by the caller and passed as generated bytes
      // The caller sets filePath = null and fileType = 'generated' with a special type
    }

    // Separator page
    const separatorBytes = await generateSeparatorPage(item.label, item.docNumber, item.date)
    const separatorDoc = await PDFDocument.load(separatorBytes)
    const [separatorPage] = await merged.copyPages(separatorDoc, [0])
    merged.addPage(separatorPage)

    // Document pages
    if (pdfBytes) {
      try {
        const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
        const pageIndices = Array.from({ length: srcDoc.getPageCount() }, (_, i) => i)
        const copiedPages = await merged.copyPages(srcDoc, pageIndices)
        copiedPages.forEach((p) => merged.addPage(p))
      } catch (err) {
        console.error(`Failed to load PDF for ${item.label}:`, err)
      }
    }
  }

  // Page numbers
  addPageNumbers(merged, font)

  return merged.save()
}

// ── Write-off summary bytes helper ───────────────────────────────────────────

export async function generateWriteOffSummaryBytes(
  data: import('./write-off-summary').WriteOffSummaryData,
): Promise<Uint8Array> {
  const React = await import('react')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { WriteOffSummaryDocument } = await import('./write-off-summary')
  return await renderToBuffer(
    React.createElement(WriteOffSummaryDocument, { data }) as React.ReactElement<import('@react-pdf/renderer').DocumentProps>,
  )
}

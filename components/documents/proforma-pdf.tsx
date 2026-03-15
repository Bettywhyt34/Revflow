import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import { toWords } from 'number-to-words'
import path from 'path'

// ── Font registration ────────────────────────────────────────────────────────
// NotoSans includes ₦ (U+20A6 Naira Sign) and full Latin character set.
// WOFF files are committed to public/fonts/ and loaded via absolute path.

Font.register({
  family: 'NotoSans',
  fonts: [
    {
      src: path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf'),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf'),
      fontWeight: 700,
    },
  ],
})

// ── Types ──────────────────────────────────────────────────────────────────

export interface PdfLineItem {
  qty: number
  description: string
  unitPrice: number
  lineTotal: number
}

export interface ProformaInvoiceData {
  orgName: string
  logoUrl: string | null
  primaryColor: string
  documentTitle?: string   // defaults to "PROFORMA INVOICE"
  invoiceNumber: string
  issueDate: string        // Pre-formatted string, e.g. "15/03/2026"
  recipientName: string
  recipientAddress: string | null
  customerId: string
  invoiceSubject: string
  currency: string
  lineItems: PdfLineItem[]
  subtotal: number
  vatAmount: number
  totalAmount: number
  notes: string | null
}

// ── Amount formatter ────────────────────────────────────────────────────────

function fmtAmt(amount: number, currency: string): string {
  const n = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Use ₦ unicode for NGN (renders correctly with NotoSans font)
  const sym = currency === 'NGN' ? '\u20A6' : currency + ' '
  return sym + n
}

// ── Amount in words ─────────────────────────────────────────────────────────

function toNairaWords(amount: number): string {
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase() + ' NAIRA'
  if (kobo > 0) result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  return result + ' ONLY'
}

// ── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(primaryColor: string) {
  return StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      paddingHorizontal: 40,
      paddingTop: 36,
      paddingBottom: 40,
      fontFamily: 'NotoSans',
      fontSize: 10,
      color: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
    },
    // ── Header ──────────────────────────────────────────────────────────────
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    logo: {
      width: 140,
      height: 64,
      objectFit: 'contain',
    },
    orgNameText: {
      fontSize: 22,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
    },
    titleBlock: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingTop: 4,
    },
    documentTitle: {
      fontSize: 26,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: '#1a1a4e',
      textAlign: 'right',
    },
    // ── Divider ─────────────────────────────────────────────────────────────
    divider: {
      borderBottomWidth: 3,
      borderBottomColor: primaryColor,
      marginBottom: 18,
    },
    // ── Meta block ──────────────────────────────────────────────────────────
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
    },
    metaLeft: {
      flex: 1,
      flexDirection: 'column',
      gap: 9,
    },
    metaItem: {
      flexDirection: 'column',
    },
    metaLabel: {
      fontSize: 8,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      marginBottom: 3,
      textTransform: 'uppercase',
    },
    metaValue: {
      fontSize: 10,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: '#1a1a1a',
    },
    metaRight: {
      flex: 1,
      alignItems: 'flex-end',
    },
    toLabel: {
      fontSize: 8,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      marginBottom: 4,
    },
    toName: {
      fontSize: 11,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: '#1a1a1a',
      textAlign: 'right',
    },
    toAddress: {
      fontSize: 9,
      color: '#555555',
      textAlign: 'right',
      marginTop: 4,
      maxWidth: 180,
    },
    // ── Subject ──────────────────────────────────────────────────────────────
    subjectLabel: {
      fontSize: 9,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      marginBottom: 4,
    },
    subjectBox: {
      borderWidth: 1,
      borderColor: primaryColor,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 14,
    },
    subjectText: {
      fontSize: 9,
      color: '#1a1a1a',
    },
    // ── Table ────────────────────────────────────────────────────────────────
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      paddingVertical: 7,
      paddingHorizontal: 6,
    },
    tableHeaderCell: {
      color: '#ffffff',
      fontFamily: 'NotoSans',
      fontWeight: 700,
      fontSize: 8,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#d1d5db',
      paddingVertical: 5,
      paddingHorizontal: 6,
      minHeight: 22,
    },
    emptyRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#d1d5db',
      height: 22,
      paddingHorizontal: 6,
    },
    // Column widths
    colQty:       { width: '8%' },
    colDesc:      { width: '47%' },
    colUnitPrice: { width: '23%', textAlign: 'right' },
    colTotal:     { width: '22%', textAlign: 'right' },
    cellText:     { fontSize: 9, color: '#1a1a1a' },
    // ── Total ────────────────────────────────────────────────────────────────
    totalSection: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 16,
    },
    totalLabel: {
      fontSize: 12,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      marginRight: 14,
    },
    totalBox: {
      borderWidth: 2,
      borderColor: primaryColor,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    totalAmount: {
      fontSize: 12,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: '#1a1a1a',
    },
    // ── Amount in words ──────────────────────────────────────────────────────
    amountInWordsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 22,
      flexWrap: 'wrap',
    },
    amountInWordsLabel: {
      fontSize: 8,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      marginRight: 6,
    },
    amountInWordsText: {
      fontSize: 9,
      color: '#1a1a1a',
      flex: 1,
    },
    // ── Footer ───────────────────────────────────────────────────────────────
    footer: {
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
    },
    thankYou: {
      fontSize: 10,
      fontFamily: 'NotoSans',
      fontWeight: 700,
      color: primaryColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    noteText: {
      fontSize: 8,
      color: '#666666',
      textAlign: 'center',
    },
  })
}

// ── PDF Component ────────────────────────────────────────────────────────────

const EMPTY_ROWS = 5

export default function ProformaInvoicePDF({ data }: { data: ProformaInvoiceData }) {
  const styles = buildStyles(data.primaryColor)
  const amountInWords = data.totalAmount > 0 ? toNairaWords(data.totalAmount) : '—'

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.orgNameText}>{data.orgName}</Text>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.documentTitle}>
              {data.documentTitle ?? 'PROFORMA INVOICE'}
            </Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Meta block: DATE / INVOICE# / CUSTOMER ID | TO ── */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {(
              [
                ['DATE', data.issueDate],
                ['INVOICE #', data.invoiceNumber],
                ['CUSTOMER ID', data.customerId],
              ] as [string, string][]
            ).map(([label, value]) => (
              <View key={label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{label}</Text>
                <Text style={styles.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.toLabel}>TO:</Text>
            <Text style={styles.toName}>{data.recipientName}</Text>
            {data.recipientAddress ? (
              <Text style={styles.toAddress}>{data.recipientAddress}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Subject ── */}
        <Text style={styles.subjectLabel}>SUBJECT:</Text>
        <View style={styles.subjectBox}>
          <Text style={styles.subjectText}>{data.invoiceSubject}</Text>
        </View>

        {/* ── Table header ── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>QTY</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>DESCRIPTION</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>UNIT PRICE</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>LINE TOTAL</Text>
        </View>

        {/* ── Line item rows ── */}
        {data.lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colQty]}>
              {item.qty > 0 ? String(item.qty) : ''}
            </Text>
            <Text style={[styles.cellText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colUnitPrice]}>
              {item.unitPrice > 0 ? fmtAmt(item.unitPrice, data.currency) : ''}
            </Text>
            <Text style={[styles.cellText, styles.colTotal]}>
              {item.lineTotal > 0 ? fmtAmt(item.lineTotal, data.currency) : ''}
            </Text>
          </View>
        ))}

        {/* ── VAT row ── */}
        <View style={styles.tableRow}>
          <Text style={[styles.cellText, styles.colQty]}>{''}</Text>
          <Text style={[styles.cellText, styles.colDesc]}>Vat@ 7.5%</Text>
          <Text style={[styles.cellText, styles.colUnitPrice]}>{''}</Text>
          <Text style={[styles.cellText, styles.colTotal]}>
            {data.vatAmount > 0 ? fmtAmt(data.vatAmount, data.currency) : ''}
          </Text>
        </View>

        {/* ── Empty rows (fill page) ── */}
        {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.emptyRow}>
            <Text style={[styles.cellText, styles.colQty]}>{' '}</Text>
            <Text style={[styles.cellText, styles.colDesc]}>{' '}</Text>
            <Text style={[styles.cellText, styles.colUnitPrice]}>{' '}</Text>
            <Text style={[styles.cellText, styles.colTotal]}>{' '}</Text>
          </View>
        ))}

        {/* ── TOTAL ── */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalAmount}>{fmtAmt(data.totalAmount, data.currency)}</Text>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <View style={styles.amountInWordsRow}>
          <Text style={styles.amountInWordsLabel}>AMOUNT IN WORDS:</Text>
          <Text style={styles.amountInWordsText}>{amountInWords}</Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.thankYou}>THANK YOU FOR YOUR BUSINESS</Text>
          <Text style={styles.noteText}>
            {data.notes
              ? `NOTE: ${data.notes}`
              : `NOTE: All cheques should be in favor of ${data.orgName}`}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

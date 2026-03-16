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
import type { DocumentTemplateData } from './template-types'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf'), fontWeight: 700 },
  ],
})

function fmtAmt(amount: number, currency: string): string {
  const n = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sym = currency === 'NGN' ? '\u20A6' : currency + ' '
  return sym + n
}

function toNairaWords(amount: number): string {
  if (amount <= 0) return '—'
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase() + ' NAIRA'
  if (kobo > 0) result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  return result + ' ONLY'
}

function buildStyles(pc: string) {
  return StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      fontFamily: 'NotoSans',
      fontSize: 10,
      color: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
    },
    // ── Dark header ─────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: pc,
      paddingHorizontal: 40,
      paddingVertical: 26,
      marginBottom: 24,
    },
    logo: { width: 100, height: 46, objectFit: 'contain' },
    headerOrgName: { fontSize: 18, fontWeight: 700, color: '#ffffff' },
    headerTitleBlock: { alignItems: 'flex-end' },
    headerTitle: { fontSize: 24, fontWeight: 700, color: '#ffffff', letterSpacing: 1 },
    headerInvNum: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.75)',
      textAlign: 'right',
      marginTop: 4,
    },
    headerBalLabel: {
      fontSize: 9,
      color: 'rgba(255,255,255,0.65)',
      textAlign: 'right',
      marginTop: 6,
    },
    headerBalAmt: { fontSize: 14, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
    // ── Body padding ────────────────────────────────────────────────────────
    body: { paddingHorizontal: 40, flex: 1 },
    // ── Info cards ──────────────────────────────────────────────────────────
    cardsRow: { flexDirection: 'row', marginBottom: 20 },
    card: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e8e8e8',
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginRight: 12,
    },
    cardRight: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e8e8e8',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    cardSectionLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: '#999',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    cardFieldRow: { flexDirection: 'row', marginBottom: 4 },
    cardFieldLabel: { fontSize: 8, fontWeight: 700, color: '#777', width: 65 },
    cardFieldValue: { fontSize: 8, color: '#1a1a1a', flex: 1 },
    cardBillName: { fontSize: 11, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 },
    cardBillAddress: { fontSize: 9, color: '#666' },
    // ── Subject with left border accent ─────────────────────────────────────
    subjectBox: {
      borderLeftWidth: 4,
      borderLeftColor: pc,
      paddingLeft: 12,
      paddingTop: 6,
      paddingBottom: 6,
      marginBottom: 18,
    },
    subjectLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: '#999',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    subjectText: { fontSize: 9, color: '#333' },
    // ── Table ────────────────────────────────────────────────────────────────
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: pc,
      paddingVertical: 7,
      paddingHorizontal: 6,
    },
    thCell: { fontSize: 8, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      paddingVertical: 5,
      paddingHorizontal: 6,
      minHeight: 22,
    },
    emptyRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      height: 22,
      paddingHorizontal: 6,
    },
    cellText: { fontSize: 9, color: '#333' },
    // Column widths — proforma
    pColQty:  { width: '8%' },
    pColDesc: { width: '47%' },
    pColUnit: { width: '23%', textAlign: 'right' },
    pColLine: { width: '22%', textAlign: 'right' },
    // Column widths — invoice
    iColNum:  { width: '6%' },
    iColItem: { width: '46%' },
    iColQty:  { width: '10%', textAlign: 'right' },
    iColRate: { width: '18%', textAlign: 'right' },
    iColAmt:  { width: '20%', textAlign: 'right' },
    // ── Totals rounded box ───────────────────────────────────────────────────
    totalsWrapper: { alignItems: 'flex-end', marginTop: 14, marginBottom: 16 },
    totalsBox: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 6,
      overflow: 'hidden',
      width: 230,
    },
    totalsRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    totalsRowLast: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: pc,
    },
    totalsLabel: { flex: 1, fontSize: 9, color: '#666' },
    totalsValue: { fontSize: 9, color: '#1a1a1a', textAlign: 'right' },
    totalsLabelBold: { flex: 1, fontSize: 10, fontWeight: 700, color: '#ffffff' },
    totalsValueBold: { fontSize: 10, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
    // ── Amount in words ──────────────────────────────────────────────────────
    amtWordsRow: { flexDirection: 'row', marginBottom: 18, flexWrap: 'wrap' },
    amtWordsLabel: {
      fontSize: 8,
      fontWeight: 700,
      color: pc,
      marginRight: 6,
      textTransform: 'uppercase',
    },
    amtWordsText: { fontSize: 9, color: '#555', flex: 1 },
    // ── Notes (invoice) ──────────────────────────────────────────────────────
    sectionContainer: { marginBottom: 14 },
    sectionLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: '#888',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    sectionText: { fontSize: 9, color: '#444' },
    // ── Footer brand color strip ─────────────────────────────────────────────
    footerSpacer: { flex: 1 },
    footer: {
      backgroundColor: pc,
      paddingVertical: 14,
      paddingHorizontal: 40,
    },
    thankYou: {
      fontSize: 10,
      fontWeight: 700,
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: 5,
    },
    noteText: { fontSize: 8, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  })
}

const EMPTY_ROWS = 5

export default function TemplateT3PDF({ data }: { data: DocumentTemplateData }) {
  const styles = buildStyles(data.primaryColor)
  const amountInWords = data.totalAmount > 0 ? toNairaWords(data.totalAmount) : '—'
  const isInvoice = data.documentType === 'invoice'
  const balanceDue = data.balanceDue ?? data.totalAmount

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Dark header ── */}
        <View style={styles.header}>
          <View>
            {data.logoUrl
              ? <Image src={data.logoUrl} style={styles.logo} />
              : <Text style={styles.headerOrgName}>{data.orgName}</Text>
            }
          </View>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>{data.documentTitle}</Text>
            <Text style={styles.headerInvNum}>{data.invoiceNumber || '—'}</Text>
            {isInvoice && balanceDue > 0 && (
              <>
                <Text style={styles.headerBalLabel}>Balance Due</Text>
                <Text style={styles.headerBalAmt}>{fmtAmt(balanceDue, data.currency)}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>

          {/* ── Info cards ── */}
          <View style={styles.cardsRow}>
            {isInvoice ? (
              <>
                {/* Left: Bill To */}
                <View style={styles.card}>
                  <Text style={styles.cardSectionLabel}>BILL TO</Text>
                  <Text style={styles.cardBillName}>{data.recipientName || '—'}</Text>
                  {data.recipientAddress
                    ? <Text style={styles.cardBillAddress}>{data.recipientAddress}</Text>
                    : null
                  }
                </View>
                {/* Right: Invoice details */}
                <View style={styles.cardRight}>
                  <Text style={styles.cardSectionLabel}>INVOICE DETAILS</Text>
                  {(
                    [
                      ['DATE', data.issueDate],
                      ['TERMS', data.paymentTerms ?? 'Net 30'],
                      ['DUE DATE', data.dueDate ?? '—'],
                      data.poNumber ? ['PO NUMBER', data.poNumber] : null,
                    ] as ([string, string] | null)[]
                  ).filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                    <View key={label} style={styles.cardFieldRow}>
                      <Text style={styles.cardFieldLabel}>{label}</Text>
                      <Text style={styles.cardFieldValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                {/* Left: Invoice details */}
                <View style={styles.card}>
                  <Text style={styles.cardSectionLabel}>INVOICE DETAILS</Text>
                  {(
                    [
                      ['DATE', data.issueDate],
                      ['INVOICE #', data.invoiceNumber],
                      ['CUSTOMER ID', data.customerId],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <View key={label} style={styles.cardFieldRow}>
                      <Text style={styles.cardFieldLabel}>{label}</Text>
                      <Text style={styles.cardFieldValue}>{value}</Text>
                    </View>
                  ))}
                </View>
                {/* Right: Bill To */}
                <View style={styles.cardRight}>
                  <Text style={styles.cardSectionLabel}>BILL TO</Text>
                  <Text style={styles.cardBillName}>{data.recipientName || '—'}</Text>
                  {data.recipientAddress
                    ? <Text style={styles.cardBillAddress}>{data.recipientAddress}</Text>
                    : null
                  }
                </View>
              </>
            )}
          </View>

          {/* ── Subject with left border ── */}
          <View style={styles.subjectBox}>
            <Text style={styles.subjectLabel}>SUBJECT</Text>
            <Text style={styles.subjectText}>{data.invoiceSubject || '—'}</Text>
          </View>

          {/* ── Table header ── */}
          <View style={styles.tableHeaderRow}>
            {isInvoice ? (
              <>
                <Text style={[styles.thCell, styles.iColNum]}>#</Text>
                <Text style={[styles.thCell, styles.iColItem]}>ITEM & DESCRIPTION</Text>
                <Text style={[styles.thCell, styles.iColQty]}>QTY</Text>
                <Text style={[styles.thCell, styles.iColRate]}>RATE</Text>
                <Text style={[styles.thCell, styles.iColAmt]}>AMOUNT</Text>
              </>
            ) : (
              <>
                <Text style={[styles.thCell, styles.pColQty]}>QTY</Text>
                <Text style={[styles.thCell, styles.pColDesc]}>DESCRIPTION</Text>
                <Text style={[styles.thCell, styles.pColUnit]}>UNIT PRICE</Text>
                <Text style={[styles.thCell, styles.pColLine]}>LINE TOTAL</Text>
              </>
            )}
          </View>

          {/* ── Line items ── */}
          {data.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              {isInvoice ? (
                <>
                  <Text style={[styles.cellText, styles.iColNum]}>{i + 1}</Text>
                  <Text style={[styles.cellText, styles.iColItem]}>{item.description}</Text>
                  <Text style={[styles.cellText, styles.iColQty]}>
                    {item.qty > 0 ? String(item.qty) : ''}
                  </Text>
                  <Text style={[styles.cellText, styles.iColRate]}>
                    {item.unitPrice > 0 ? fmtAmt(item.unitPrice, data.currency) : ''}
                  </Text>
                  <Text style={[styles.cellText, styles.iColAmt]}>
                    {item.lineTotal > 0 ? fmtAmt(item.lineTotal, data.currency) : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.cellText, styles.pColQty]}>
                    {item.qty > 0 ? String(item.qty) : ''}
                  </Text>
                  <Text style={[styles.cellText, styles.pColDesc]}>{item.description}</Text>
                  <Text style={[styles.cellText, styles.pColUnit]}>
                    {item.unitPrice > 0 ? fmtAmt(item.unitPrice, data.currency) : ''}
                  </Text>
                  <Text style={[styles.cellText, styles.pColLine]}>
                    {item.lineTotal > 0 ? fmtAmt(item.lineTotal, data.currency) : ''}
                  </Text>
                </>
              )}
            </View>
          ))}

          {/* ── VAT row ── */}
          <View style={styles.tableRow}>
            {isInvoice ? (
              <>
                <Text style={[styles.cellText, styles.iColNum]}>{' '}</Text>
                <Text style={[styles.cellText, styles.iColItem]}>Vat@ 7.5%</Text>
                <Text style={[styles.cellText, styles.iColQty]}>{' '}</Text>
                <Text style={[styles.cellText, styles.iColRate]}>{' '}</Text>
                <Text style={[styles.cellText, styles.iColAmt]}>
                  {data.vatAmount > 0 ? fmtAmt(data.vatAmount, data.currency) : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.cellText, styles.pColQty]}>{' '}</Text>
                <Text style={[styles.cellText, styles.pColDesc]}>Vat@ 7.5%</Text>
                <Text style={[styles.cellText, styles.pColUnit]}>{' '}</Text>
                <Text style={[styles.cellText, styles.pColLine]}>
                  {data.vatAmount > 0 ? fmtAmt(data.vatAmount, data.currency) : ''}
                </Text>
              </>
            )}
          </View>

          {/* ── Empty rows ── */}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.emptyRow}>
              <Text style={styles.cellText}>{' '}</Text>
            </View>
          ))}

          {/* ── Totals (rounded box) ── */}
          <View style={styles.totalsWrapper}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Sub Total</Text>
                <Text style={styles.totalsValue}>{fmtAmt(data.subtotal, data.currency)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT 7.5%</Text>
                <Text style={styles.totalsValue}>{fmtAmt(data.vatAmount, data.currency)}</Text>
              </View>
              {isInvoice && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total</Text>
                  <Text style={styles.totalsValue}>{fmtAmt(data.totalAmount, data.currency)}</Text>
                </View>
              )}
              <View style={styles.totalsRowLast}>
                <Text style={styles.totalsLabelBold}>
                  {isInvoice ? 'BALANCE DUE' : 'TOTAL'}
                </Text>
                <Text style={styles.totalsValueBold}>
                  {fmtAmt(isInvoice ? balanceDue : data.totalAmount, data.currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Amount in words ── */}
          <View style={styles.amtWordsRow}>
            <Text style={styles.amtWordsLabel}>AMOUNT IN WORDS:</Text>
            <Text style={styles.amtWordsText}>{amountInWords}</Text>
          </View>

          {/* ── Notes (invoice) ── */}
          {isInvoice && data.notes && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <Text style={styles.sectionText}>{data.notes}</Text>
            </View>
          )}

        </View>

        {/* ── Spacer + Footer ── */}
        <View style={styles.footerSpacer} />
        <View style={styles.footer}>
          <Text style={styles.thankYou}>THANK YOU FOR YOUR BUSINESS</Text>
          <Text style={styles.noteText}>
            {!isInvoice && data.notes
              ? `NOTE: ${data.notes}`
              : `NOTE: All cheques should be in favor of ${data.orgName}`}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

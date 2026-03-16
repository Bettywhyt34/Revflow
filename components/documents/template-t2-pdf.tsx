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
      paddingHorizontal: 40,
      paddingTop: 32,
      paddingBottom: 36,
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
      marginBottom: 10,
    },
    logo: { width: 90, height: 40, objectFit: 'contain' },
    orgNameText: { fontSize: 16, fontWeight: 700, color: pc },
    titleBlock: { alignItems: 'flex-end' },
    docTitle: { fontSize: 20, fontWeight: 400, color: '#1a1a1a', letterSpacing: 3 },
    balanceDueLabel: { fontSize: 8, color: '#888', textAlign: 'right', marginTop: 4 },
    balanceDueValue: { fontSize: 13, fontWeight: 700, color: pc, textAlign: 'right' },
    // ── Accent line ─────────────────────────────────────────────────────────
    accentLine: { height: 1.5, backgroundColor: pc, marginBottom: 14 },
    // ── Info band (proforma: 3 columns) ─────────────────────────────────────
    infoBand: {
      flexDirection: 'row',
      backgroundColor: '#f4f4f4',
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    infoItem: { flex: 1 },
    infoLabel: { fontSize: 7, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 2 },
    infoValue: { fontSize: 10, fontWeight: 700, color: '#1a1a1a' },
    // ── Invoice info (two columns) ───────────────────────────────────────────
    infoTwoCol: { flexDirection: 'row', marginBottom: 16 },
    infoColLeft: { flex: 1 },
    infoColRight: { flex: 1 },
    infoFieldRow: { flexDirection: 'row', marginBottom: 3 },
    infoFieldLabel: { fontSize: 8, fontWeight: 700, color: '#888', width: 65 },
    infoFieldValue: { fontSize: 8, color: '#1a1a1a', flex: 1 },
    billToLabel: { fontSize: 7, fontWeight: 700, color: pc, textTransform: 'uppercase', marginBottom: 4 },
    billToName: { fontSize: 11, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 },
    billToAddress: { fontSize: 9, color: '#666' },
    // ── TO section (proforma) ────────────────────────────────────────────────
    toSection: { marginBottom: 14 },
    toLabel: { fontSize: 7, fontWeight: 700, color: pc, textTransform: 'uppercase', marginBottom: 3 },
    toName: { fontSize: 11, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 },
    toAddress: { fontSize: 9, color: '#666' },
    // ── Subject ──────────────────────────────────────────────────────────────
    subjectRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    subjectLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: pc,
      textTransform: 'uppercase',
      marginRight: 8,
      marginTop: 1.5,
    },
    subjectText: { fontSize: 9, color: '#333', flex: 1 },
    // ── Table (minimal borders) ──────────────────────────────────────────────
    tableHeaderRow: {
      flexDirection: 'row',
      borderBottomWidth: 1.5,
      borderBottomColor: pc,
      paddingBottom: 5,
      paddingHorizontal: 4,
    },
    thCell: { fontSize: 8, fontWeight: 700, color: pc, textTransform: 'uppercase' },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      paddingVertical: 5,
      paddingHorizontal: 4,
      minHeight: 22,
    },
    tableRowAlt: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      paddingVertical: 5,
      paddingHorizontal: 4,
      minHeight: 22,
      backgroundColor: '#fafafa',
    },
    emptyRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      height: 22,
      paddingHorizontal: 4,
    },
    emptyRowAlt: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      height: 22,
      paddingHorizontal: 4,
      backgroundColor: '#fafafa',
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
    // ── Totals ───────────────────────────────────────────────────────────────
    totalsBlock: { marginTop: 10, marginBottom: 14 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 3,
      paddingHorizontal: 4,
    },
    totalLabel:     { fontSize: 9,  color: '#777', width: 90, textAlign: 'right', marginRight: 12 },
    totalValue:     { fontSize: 9,  color: '#1a1a1a', width: 90, textAlign: 'right' },
    totalDivider:   { borderTopWidth: 1, borderTopColor: '#eeeeee', marginBottom: 3, marginLeft: '60%' },
    totalLabelBold: { fontSize: 10, fontWeight: 700, color: pc, width: 90, textAlign: 'right', marginRight: 12 },
    totalValueBold: { fontSize: 10, fontWeight: 700, color: pc, width: 90, textAlign: 'right' },
    // ── Amount in words ──────────────────────────────────────────────────────
    amtWordsRow: { flexDirection: 'row', marginBottom: 18, flexWrap: 'wrap' },
    amtWordsLabel: { fontSize: 8, fontWeight: 700, color: '#bbb', marginRight: 6 },
    amtWordsText:  { fontSize: 9, color: '#c0c0c0', flex: 1 },
    // ── Notes (invoice) ──────────────────────────────────────────────────────
    sectionContainer: { marginBottom: 14 },
    sectionLabel: { fontSize: 7, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 3 },
    sectionText:  { fontSize: 9, color: '#444' },
    // ── Footer ───────────────────────────────────────────────────────────────
    footer: {
      borderTopWidth: 1,
      borderTopColor: '#eeeeee',
      paddingTop: 10,
      marginTop: 16,
    },
    thankYou: { fontSize: 10, fontWeight: 700, color: pc, textAlign: 'center', marginBottom: 4 },
    noteText: { fontSize: 8, color: '#c0c0c0', textAlign: 'center' },
  })
}

const EMPTY_ROWS = 5

export default function TemplateT2PDF({ data }: { data: DocumentTemplateData }) {
  const styles = buildStyles(data.primaryColor)
  const amountInWords = data.totalAmount > 0 ? toNairaWords(data.totalAmount) : '—'
  const isInvoice = data.documentType === 'invoice'
  const balanceDue = data.balanceDue ?? data.totalAmount

  const rowStyle = (i: number) => (i % 2 === 1 ? styles.tableRowAlt : styles.tableRow)
  const emptyStyle = (i: number) => (i % 2 === 1 ? styles.emptyRowAlt : styles.emptyRow)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            {data.logoUrl
              ? <Image src={data.logoUrl} style={styles.logo} />
              : <Text style={styles.orgNameText}>{data.orgName}</Text>
            }
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.docTitle}>{data.documentTitle}</Text>
            {isInvoice && balanceDue > 0 && (
              <>
                <Text style={styles.balanceDueLabel}>Balance Due</Text>
                <Text style={styles.balanceDueValue}>{fmtAmt(balanceDue, data.currency)}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Accent line ── */}
        <View style={styles.accentLine} />

        {/* ── Info section ── */}
        {isInvoice ? (
          <View style={styles.infoTwoCol}>
            <View style={styles.infoColLeft}>
              <Text style={styles.billToLabel}>BILL TO</Text>
              <Text style={styles.billToName}>{data.recipientName || '—'}</Text>
              {data.recipientAddress
                ? <Text style={styles.billToAddress}>{data.recipientAddress}</Text>
                : null
              }
            </View>
            <View style={styles.infoColRight}>
              {(
                [
                  ['INVOICE DATE', data.issueDate],
                  ['TERMS', data.paymentTerms ?? 'Net 30'],
                  ['DUE DATE', data.dueDate ?? '—'],
                  data.poNumber ? ['PO NUMBER', data.poNumber] : null,
                ] as ([string, string] | null)[]
              ).filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                <View key={label} style={styles.infoFieldRow}>
                  <Text style={styles.infoFieldLabel}>{label}</Text>
                  <Text style={styles.infoFieldValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.infoBand}>
              {(
                [
                  ['DATE', data.issueDate],
                  ['INVOICE #', data.invoiceNumber],
                  ['CUSTOMER ID', data.customerId],
                ] as [string, string][]
              ).map(([label, value]) => (
                <View key={label} style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.toSection}>
              <Text style={styles.toLabel}>TO:</Text>
              <Text style={styles.toName}>{data.recipientName || '—'}</Text>
              {data.recipientAddress
                ? <Text style={styles.toAddress}>{data.recipientAddress}</Text>
                : null
              }
            </View>
          </>
        )}

        {/* ── Subject ── */}
        <View style={styles.subjectRow}>
          <Text style={styles.subjectLabel}>SUBJECT:</Text>
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
          <View key={i} style={rowStyle(i)}>
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
        <View style={rowStyle(data.lineItems.length)}>
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
          <View key={`empty-${i}`} style={emptyStyle(data.lineItems.length + 1 + i)}>
            <Text style={styles.cellText}>{' '}</Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sub Total</Text>
            <Text style={styles.totalValue}>{fmtAmt(data.subtotal, data.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT 7.5%</Text>
            <Text style={styles.totalValue}>{fmtAmt(data.vatAmount, data.currency)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelBold}>TOTAL</Text>
            <Text style={styles.totalValueBold}>{fmtAmt(data.totalAmount, data.currency)}</Text>
          </View>
          {isInvoice && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelBold}>BALANCE DUE</Text>
              <Text style={styles.totalValueBold}>{fmtAmt(balanceDue, data.currency)}</Text>
            </View>
          )}
        </View>

        {/* ── Amount in words ── */}
        <View style={styles.amtWordsRow}>
          <Text style={styles.amtWordsLabel}>AMOUNT IN WORDS:</Text>
          <Text style={styles.amtWordsText}>{amountInWords}</Text>
        </View>

        {/* ── Notes section (invoice) ── */}
        {isInvoice && data.notes && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.sectionText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.thankYou}>Thank you for your business</Text>
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

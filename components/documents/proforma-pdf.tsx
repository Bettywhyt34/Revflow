import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import { toWords } from 'number-to-words'

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
  issueDate: string
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtAmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function toNairaWords(amount: number): string {
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase()
  result += ' NAIRA'
  if (kobo > 0) {
    result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  }
  return result + ' ONLY'
}

// ── Styles ─────────────────────────────────────────────────────────────────

function buildStyles(primaryColor: string) {
  return StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      paddingHorizontal: 42,
      paddingVertical: 36,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: '#1a1a1a',
    },
    // Header
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    logo: {
      width: 100,
      height: 48,
      objectFit: 'contain',
    },
    orgNameText: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
    },
    proformaTitle: {
      fontSize: 18,
      fontFamily: 'Helvetica-Bold',
      color: '#1a1a4e',
      textAlign: 'right',
    },
    // Divider
    divider: {
      borderBottomWidth: 2,
      borderBottomColor: primaryColor,
      marginBottom: 14,
    },
    // Meta block
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    metaLeft: {
      flexDirection: 'column',
    },
    metaLineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    metaLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      width: 80,
    },
    metaValue: {
      fontSize: 9,
      color: '#1a1a1a',
      flex: 1,
    },
    metaRight: {
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    toLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginBottom: 4,
    },
    toName: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: '#1a1a1a',
      textAlign: 'right',
    },
    toAddress: {
      fontSize: 9,
      color: '#666666',
      textAlign: 'right',
      marginTop: 2,
      maxWidth: 180,
    },
    // Subject section
    subjectLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginBottom: 4,
    },
    subjectBox: {
      borderWidth: 1,
      borderColor: primaryColor,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 14,
      borderRadius: 2,
    },
    subjectText: {
      fontSize: 9,
      color: '#1a1a1a',
    },
    // Table
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    tableHeaderCell: {
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      fontSize: 8,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      paddingVertical: 5,
      paddingHorizontal: 4,
      minHeight: 22,
    },
    // Column widths
    colQty: { width: '8%' },
    colDesc: { width: '47%' },
    colUnitPrice: { width: '23%', textAlign: 'right' },
    colTotal: { width: '22%', textAlign: 'right' },
    cellText: { fontSize: 9, color: '#1a1a1a' },
    cellTextGray: { fontSize: 9, color: '#999999' },
    // Total section
    totalSection: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    totalLabel: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginRight: 12,
    },
    totalBox: {
      borderWidth: 2,
      borderColor: primaryColor,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 2,
    },
    totalAmount: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#1a1a1a',
    },
    // Amount in words
    amountInWordsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 22,
      flexWrap: 'wrap',
    },
    amountInWordsLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginRight: 6,
    },
    amountInWordsText: {
      fontSize: 9,
      color: '#1a1a1a',
      flex: 1,
    },
    // Footer
    thankYou: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      textAlign: 'center',
      marginBottom: 6,
    },
    noteText: {
      fontSize: 9,
      color: '#666666',
      textAlign: 'center',
    },
  })
}

// ── PDF Component ───────────────────────────────────────────────────────────

export default function ProformaInvoicePDF({ data }: { data: ProformaInvoiceData }) {
  const styles = buildStyles(data.primaryColor)
  const amountInWords = data.totalAmount > 0 ? toNairaWords(data.totalAmount) : '—'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.orgNameText}>{data.orgName}</Text>
            )}
          </View>
          <View>
            <Text style={styles.proformaTitle}>{data.documentTitle ?? 'PROFORMA INVOICE'}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Meta block */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <View style={styles.metaLineRow}>
              <Text style={styles.metaLabel}>DATE:</Text>
              <Text style={styles.metaValue}>{data.issueDate}</Text>
            </View>
            <View style={styles.metaLineRow}>
              <Text style={styles.metaLabel}>INVOICE #:</Text>
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </View>
            <View style={styles.metaLineRow}>
              <Text style={styles.metaLabel}>CUSTOMER ID:</Text>
              <Text style={styles.metaValue}>{data.customerId}</Text>
            </View>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.toLabel}>TO:</Text>
            <Text style={styles.toName}>{data.recipientName}</Text>
            {data.recipientAddress ? (
              <Text style={styles.toAddress}>{data.recipientAddress}</Text>
            ) : null}
          </View>
        </View>

        {/* Subject */}
        <Text style={styles.subjectLabel}>SUBJECT:</Text>
        <View style={styles.subjectBox}>
          <Text style={styles.subjectText}>{data.invoiceSubject}</Text>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>QTY</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>DESCRIPTION</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>UNIT PRICE</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>LINE TOTAL</Text>
        </View>

        {/* Line item rows */}
        {data.lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colQty]}>{item.qty > 0 ? String(item.qty) : ''}</Text>
            <Text style={[styles.cellText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colUnitPrice]}>
              {item.unitPrice > 0 ? fmtAmt(item.unitPrice, data.currency) : ''}
            </Text>
            <Text style={[styles.cellText, styles.colTotal]}>
              {item.lineTotal > 0 ? fmtAmt(item.lineTotal, data.currency) : ''}
            </Text>
          </View>
        ))}

        {/* VAT row */}
        <View style={styles.tableRow}>
          <Text style={[styles.cellTextGray, styles.colQty]}></Text>
          <Text style={[styles.cellText, styles.colDesc]}>VAT @ 7.5%</Text>
          <Text style={[styles.cellTextGray, styles.colUnitPrice]}></Text>
          <Text style={[styles.cellText, styles.colTotal]}>
            {data.vatAmount > 0 ? fmtAmt(data.vatAmount, data.currency) : ''}
          </Text>
        </View>

        {/* TOTAL */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalAmount}>{fmtAmt(data.totalAmount, data.currency)}</Text>
          </View>
        </View>

        {/* Amount in words */}
        <View style={styles.amountInWordsRow}>
          <Text style={styles.amountInWordsLabel}>AMOUNT IN WORDS:</Text>
          <Text style={styles.amountInWordsText}>{amountInWords}</Text>
        </View>

        {/* Thank you */}
        <Text style={styles.thankYou}>THANK YOU FOR YOUR BUSINESS</Text>

        {/* Note */}
        <Text style={styles.noteText}>
          {data.notes
            ? `NOTE: ${data.notes}`
            : `NOTE: All cheques should be in favor of ${data.orgName}`}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * lib/pdf/write-off-summary.tsx
 * Write-off summary PDF using @react-pdf/renderer
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface WriteOffSummaryData {
  orgName: string
  campaign: {
    tracker_id: string
    title: string
    advertiser: string
    currency: string
  }
  plannedValue: number
  complianceAmount: number
  compliancePct: number
  writeOffAmount: number
  journalRef?: string
  reportDate: string
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
  },
  orgName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0D9488',
  },
  docTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0D9488',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: {
    fontSize: 9,
    color: '#374151',
  },
  rowValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  writeOffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  writeOffLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
  },
  writeOffValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
  },
  journalBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  journalTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 8,
  },
  journalRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  journalAccount: {
    fontSize: 8,
    color: '#6b7280',
    width: 60,
  },
  journalDescription: {
    fontSize: 8,
    color: '#374151',
    flex: 1,
  },
  journalDebit: {
    fontSize: 8,
    color: '#374151',
    width: 80,
    textAlign: 'right',
  },
  journalCredit: {
    fontSize: 8,
    color: '#374151',
    width: 80,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'center',
  },
})

export function WriteOffSummaryDocument({ data }: { data: WriteOffSummaryData }) {
  const currency = data.campaign.currency

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.orgName}>{data.orgName}</Text>
            <Text style={styles.docTitle}>WRITE-OFF SUMMARY</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.label}>Report Date</Text>
            <Text style={styles.value}>{fmtDate(data.reportDate)}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Tracker ID</Text>
            <Text style={styles.value}>{data.campaign.tracker_id}</Text>
          </View>
        </View>

        {/* Campaign details */}
        <Text style={styles.sectionTitle}>Campaign Details</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Campaign Title</Text>
          <Text style={styles.rowValue}>{data.campaign.title}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Advertiser</Text>
          <Text style={styles.rowValue}>{data.campaign.advertiser}</Text>
        </View>

        {/* Financial summary */}
        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Planned Contract Value</Text>
          <Text style={styles.rowValue}>{fmtCurrency(data.plannedValue, currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Compliance Amount</Text>
          <Text style={styles.rowValue}>{fmtCurrency(data.complianceAmount, currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Compliance %</Text>
          <Text style={styles.rowValue}>{(data.compliancePct * 100).toFixed(2)}%</Text>
        </View>

        <View style={styles.writeOffRow}>
          <Text style={styles.writeOffLabel}>Write-Off Amount</Text>
          <Text style={styles.writeOffValue}>{fmtCurrency(data.writeOffAmount, currency)}</Text>
        </View>

        {/* Journal entry reference */}
        <View style={styles.journalBox}>
          <Text style={styles.journalTitle}>Journal Entry Reference</Text>
          <View style={styles.journalRow}>
            <Text style={styles.journalAccount}>6900</Text>
            <Text style={styles.journalDescription}>Write-Off Expense — {data.campaign.tracker_id}</Text>
            <Text style={styles.journalDebit}>{fmtCurrency(data.writeOffAmount, currency)}</Text>
            <Text style={styles.journalCredit}>—</Text>
          </View>
          <View style={styles.journalRow}>
            <Text style={styles.journalAccount}>1100</Text>
            <Text style={styles.journalDescription}>Accounts Receivable — Write-off reduction</Text>
            <Text style={styles.journalDebit}>—</Text>
            <Text style={styles.journalCredit}>{fmtCurrency(data.writeOffAmount, currency)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.orgName} · Auto-generated write-off summary · {fmtDate(data.reportDate)}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

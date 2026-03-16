/**
 * lib/pdf/compliance-report.tsx
 * Server-side compliance report PDF generator using @react-pdf/renderer
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  fonts: [],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#0D9488',
  },
  orgName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0D9488',
  },
  reportTitle: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 9,
    color: '#6b7280',
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  // Info grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  infoItem: {
    width: '48%',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 7,
    color: '#9ca3af',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 9,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  // Table
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  col1: { width: '30%' },
  col2: { width: '23%', alignItems: 'flex-end' },
  col3: { width: '23%', alignItems: 'flex-end' },
  col4: { width: '24%', alignItems: 'flex-end' },
  cellText: {
    fontSize: 9,
    color: '#374151',
  },
  cellBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  cellGreen: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
  },
  cellRed: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  cellAmber: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#d97706',
  },
  // Summary box
  summaryBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
  },
  summaryBoxAmber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#374151',
  },
  summaryValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  summaryDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#d1d5db',
    marginVertical: 6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  // Banner
  overDeliveryBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
  },
  bannerTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    marginBottom: 3,
  },
  bannerText: {
    fontSize: 8,
    color: '#1e40af',
  },
})

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export interface ComplianceReportData {
  orgName: string
  campaign: {
    tracker_id: string
    title: string
    advertiser: string
    currency: string
    start_date: string | null
    end_date: string | null
  }
  planAmount: number
  complianceAmount: number
  compliancePct: number
  finalBillable: number
  writeOff: number
  overDelivery: boolean
  overDeliveryPct: number
  confirmedByName: string
  confirmedAt: string
  reportDate: string
}

export function ComplianceReportDocument({ data }: { data: ComplianceReportData }) {
  const currency = data.campaign.currency ?? 'NGN'
  const variance = data.complianceAmount - data.planAmount

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.orgName}>{data.orgName}</Text>
            <Text style={styles.reportTitle}>COMPLIANCE REPORT</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.dateText, { fontFamily: 'Helvetica-Bold', fontSize: 10 }]}>
              {data.campaign.tracker_id}
            </Text>
            <Text style={styles.dateText}>Date: {formatDate(data.reportDate)}</Text>
          </View>
        </View>

        {/* Campaign Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campaign Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Campaign Name</Text>
              <Text style={styles.infoValue}>{data.campaign.title}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Client / Advertiser</Text>
              <Text style={styles.infoValue}>{data.campaign.advertiser}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Campaign Period</Text>
              <Text style={styles.infoValue}>
                {data.campaign.start_date
                  ? `${formatDate(data.campaign.start_date)} — ${data.campaign.end_date ? formatDate(data.campaign.end_date) : 'TBD'}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Confirmed By</Text>
              <Text style={styles.infoValue}>{data.confirmedByName}</Text>
            </View>
          </View>
        </View>

        {/* Compliance Comparison Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan vs Delivered Comparison</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.col1}><Text style={styles.tableHeaderText}>Metric</Text></View>
              <View style={styles.col2}><Text style={styles.tableHeaderText}>Plan</Text></View>
              <View style={styles.col3}><Text style={styles.tableHeaderText}>Delivered</Text></View>
              <View style={styles.col4}><Text style={styles.tableHeaderText}>Variance</Text></View>
            </View>

            {/* Amount Before VAT row */}
            <View style={styles.tableRow}>
              <View style={styles.col1}><Text style={styles.cellText}>Amount Before VAT</Text></View>
              <View style={styles.col2}><Text style={styles.cellText}>{formatCurrency(data.planAmount, currency)}</Text></View>
              <View style={styles.col3}><Text style={styles.cellBold}>{formatCurrency(data.complianceAmount, currency)}</Text></View>
              <View style={styles.col4}>
                <Text style={variance >= 0 ? styles.cellGreen : styles.cellRed}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance, currency)}
                </Text>
              </View>
            </View>

            {/* Compliance % row */}
            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <View style={styles.col1}><Text style={styles.cellText}>Compliance %</Text></View>
              <View style={styles.col2}><Text style={styles.cellText}>100.00%</Text></View>
              <View style={styles.col3}>
                <Text style={
                  data.compliancePct >= 0.9 ? styles.cellGreen
                  : data.compliancePct >= 0.7 ? styles.cellAmber
                  : styles.cellRed
                }>
                  {formatPct(data.compliancePct)}
                </Text>
              </View>
              <View style={styles.col4}>
                <Text style={data.compliancePct >= 1 ? styles.cellGreen : styles.cellRed}>
                  {data.compliancePct >= 1 ? '+' : ''}{formatPct(data.compliancePct - 1)}
                </Text>
              </View>
            </View>

            {/* Final Billable row */}
            <View style={styles.tableRow}>
              <View style={styles.col1}><Text style={styles.cellText}>Final Billable</Text></View>
              <View style={styles.col2}><Text style={styles.cellText}>{formatCurrency(data.planAmount, currency)}</Text></View>
              <View style={styles.col3}><Text style={styles.cellBold}>{formatCurrency(data.finalBillable, currency)}</Text></View>
              <View style={styles.col4}>
                <Text style={data.writeOff <= 0 ? styles.cellGreen : styles.cellRed}>
                  {data.writeOff <= 0 ? '+' : '-'}{formatCurrency(Math.abs(data.finalBillable - data.planAmount), currency)}
                </Text>
              </View>
            </View>

            {/* Write-Off row */}
            {data.writeOff > 0 && (
              <View style={[styles.tableRow, styles.tableRowAlt]}>
                <View style={styles.col1}><Text style={styles.cellText}>Write-Off</Text></View>
                <View style={styles.col2}><Text style={styles.cellText}>—</Text></View>
                <View style={styles.col3}><Text style={styles.cellRed}>{formatCurrency(data.writeOff, currency)}</Text></View>
                <View style={styles.col4}><Text style={styles.cellRed}>—</Text></View>
              </View>
            )}
          </View>
        </View>

        {/* Over-delivery banner */}
        {data.overDelivery && (
          <View style={styles.overDeliveryBanner}>
            <Text style={styles.bannerTitle}>
              Over-Delivery Detected: {formatPct(data.overDeliveryPct)} above plan
            </Text>
            <Text style={styles.bannerText}>
              Final Billable is capped at the Planned Contract Value ({formatCurrency(data.planAmount, currency)}).
              The excess delivery of {formatCurrency(data.complianceAmount - data.planAmount, currency)} is not billed.
            </Text>
          </View>
        )}

        {/* Summary box */}
        <View style={data.writeOff > 0 ? styles.summaryBoxAmber : styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Planned Contract Value</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.planAmount, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Compliance Amount Before VAT</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.complianceAmount, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Compliance %</Text>
            <Text style={styles.summaryValue}>{formatPct(data.compliancePct)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>Final Billable</Text>
            <Text style={[styles.summaryValue, { fontSize: 11 }]}>{formatCurrency(data.finalBillable, currency)}</Text>
          </View>
          {data.writeOff > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Write-Off Amount</Text>
              <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{formatCurrency(data.writeOff, currency)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by Revflow · {formatDate(data.reportDate)}
          </Text>
          <Text style={styles.footerText}>
            Confirmed by: {data.confirmedByName}
          </Text>
          <Text style={styles.footerText}>
            {data.orgName} — Confidential
          </Text>
        </View>
      </Page>
    </Document>
  )
}

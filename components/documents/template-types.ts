// ── Shared types for document templates 2 & 3 ─────────────────────────────

export type TemplateId = '1' | '2' | '3'
export type DocumentType = 'proforma' | 'invoice'

export interface TemplatePdfLineItem {
  qty: number
  description: string
  unitPrice: number
  lineTotal: number
}

export interface DocumentTemplateData {
  // Always required
  orgName: string
  orgAddress: string | null
  logoUrl: string | null
  primaryColor: string
  documentType: DocumentType
  documentTitle: string       // e.g. "PROFORMA INVOICE" | "TAX INVOICE" | "INVOICE"
  invoiceNumber: string
  issueDate: string           // pre-formatted "DD/MM/YYYY"
  recipientName: string
  recipientAddress: string | null
  customerId: string
  invoiceSubject: string
  currency: string
  lineItems: TemplatePdfLineItem[]
  subtotal: number
  vatAmount: number
  totalAmount: number
  notes: string | null
  // HTML preview only — computed in form
  amountInWords?: string
  // Invoice-specific (optional for proforma)
  dueDate?: string | null
  paymentTerms?: string | null
  poNumber?: string | null
  balanceDue?: number
}

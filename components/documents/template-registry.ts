// ── Template registry ────────────────────────────────────────────────────────
// Maps TemplateId to PDF + HTML components for proforma and invoice documents.

import type { TemplateId } from './template-types'

// Labels shown in dropdowns / settings
export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  '1': 'Template 1 — QVT Classic',
  '2': 'Template 2 — Modern Minimal',
  '3': 'Template 3 — Bold Corporate',
}

// Short names for template selector buttons
export const TEMPLATE_SHORT_LABELS: Record<TemplateId, string> = {
  '1': 'Classic',
  '2': 'Minimal',
  '3': 'Corporate',
}

export const TEMPLATE_IDS: TemplateId[] = ['1', '2', '3']

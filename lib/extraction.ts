/**
 * lib/extraction.ts
 * Server-side only — Node.js runtime required.
 */

import type { ExtractionMethod, DetectionConfidence } from '@/types'

export interface ExtractionResult {
  amount: number | null
  confidence: DetectionConfidence
  reasoning: string
  extractionMethod: ExtractionMethod
  previewRows: unknown[][] | null   // First ~30 rows of spreadsheet for preview
  pdfTextSnippet: string | null     // First 500 chars of extracted PDF text
}

// ── Keyword sets ──────────────────────────────────────────────────────────────
const SUBTOTAL_KEYWORDS = [
  'sub total', 'subtotal', 'sub-total',
  'total before vat', 'amount before vat',
  'net total', 'net amount', 'gross amount',
  'total excl', 'excl vat', 'excl. vat',
  'amount ex vat', 'pre-vat', 'pre vat',
]

function matchesKeyword(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return SUBTOTAL_KEYWORDS.some((k) => lower.includes(k))
}

function parseNumericString(val: unknown): number | null {
  if (typeof val === 'number' && val > 0) return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₦$€£,\s]/g, '')
    const n = parseFloat(cleaned)
    if (!isNaN(n) && n > 0) return n
  }
  return null
}

// ── Excel extraction ──────────────────────────────────────────────────────────
export async function extractFromExcel(buffer: Buffer): Promise<ExtractionResult> {
  const XLSX = await import('xlsx')

  let workbook: ReturnType<typeof XLSX.read>
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return {
      amount: null,
      confidence: 'not_found',
      reasoning: 'Failed to parse Excel file.',
      extractionMethod: 'excel_direct',
      previewRows: null,
      pdfTextSnippet: null,
    }
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  const previewRows = rows.slice(0, 40)

  // Pass 1: look for keyword in same row as a number
  for (const row of rows) {
    const cells = row as unknown[]
    for (let i = 0; i < cells.length; i++) {
      if (matchesKeyword(String(cells[i] ?? ''))) {
        // Search to the right for a number
        for (let j = i + 1; j < cells.length; j++) {
          const n = parseNumericString(cells[j])
          if (n !== null) {
            return {
              amount: n,
              confidence: 'high',
              reasoning: `Found "${String(cells[i]).trim()}" → ${n}`,
              extractionMethod: 'excel_direct',
              previewRows,
              pdfTextSnippet: null,
            }
          }
        }
        // Also check one cell to the left (label might be right of value)
        for (let j = i - 1; j >= 0; j--) {
          const n = parseNumericString(cells[j])
          if (n !== null) {
            return {
              amount: n,
              confidence: 'medium',
              reasoning: `Found "${String(cells[i]).trim()}" with value ${n} (left-hand cell)`,
              extractionMethod: 'excel_direct',
              previewRows,
              pdfTextSnippet: null,
            }
          }
        }
      }
    }
  }

  // Pass 2: look for "Total" keyword row and grab the largest number in that row
  for (const row of rows) {
    const cells = row as unknown[]
    const hasTotal = cells.some((c) => /\btotal\b/i.test(String(c ?? '')))
    if (hasTotal) {
      const nums = cells.map((c) => parseNumericString(c)).filter((n): n is number => n !== null)
      if (nums.length > 0) {
        const max = Math.max(...nums)
        return {
          amount: max,
          confidence: 'low',
          reasoning: `Found a "Total" row — largest value is ${max} (confirm this is the pre-VAT subtotal)`,
          extractionMethod: 'excel_direct',
          previewRows,
          pdfTextSnippet: null,
        }
      }
    }
  }

  return {
    amount: null,
    confidence: 'not_found',
    reasoning: 'Could not find a subtotal/Amount Before VAT row. Please enter the amount manually.',
    extractionMethod: 'excel_direct',
    previewRows,
    pdfTextSnippet: null,
  }
}

// ── PDF text extraction ───────────────────────────────────────────────────────
export async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  let text = ''
  let isScanned = false

  try {
    // Dynamic import avoids filesystem issues with pdf-parse in Next.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('pdf-parse') as any
    const pdfParse = mod.default ?? mod
    const data = await pdfParse(buffer)
    text = data.text ?? ''
    isScanned = text.trim().length < 80
  } catch {
    isScanned = true
  }

  if (isScanned) {
    return {
      amount: null,
      confidence: 'not_found',
      reasoning: 'PDF appears to be scanned (no text layer). Sending to AI for analysis.',
      extractionMethod: 'pdf_ocr',
      previewRows: null,
      pdfTextSnippet: null,
    }
  }

  const snippet = text.slice(0, 500)

  // Regex: look for "Sub Total: ₦12,500,000" style
  const AMOUNT_PATTERN =
    /(?:sub[\s\-]?total|total before vat|amount before vat|net total|excl\.?\s*vat)[^\d₦$]*(?:[₦$]?\s*)([\d,]+(?:\.\d{1,2})?)/gi

  let match: RegExpExecArray | null
  while ((match = AMOUNT_PATTERN.exec(text)) !== null) {
    const n = parseNumericString(match[1])
    if (n !== null) {
      return {
        amount: n,
        confidence: 'high',
        reasoning: `Found in PDF text: "${match[0].trim()}"`,
        extractionMethod: 'pdf_text',
        previewRows: null,
        pdfTextSnippet: snippet,
      }
    }
  }

  // Return not_found but carry the text so Claude can try
  return {
    amount: null,
    confidence: 'not_found',
    reasoning: 'Pattern not matched in PDF text. Sending to AI for analysis.',
    extractionMethod: 'pdf_text',
    previewRows: null,
    pdfTextSnippet: text.slice(0, 8000), // full text for Claude
  }
}

// ── Claude extraction ─────────────────────────────────────────────────────────
export async function extractWithClaude(
  textContent: string,
  isOcr: boolean,
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      amount: null,
      confidence: 'not_found',
      reasoning: 'ANTHROPIC_API_KEY not set — cannot use AI extraction.',
      extractionMethod: isOcr ? 'pdf_ocr' : 'pdf_text',
      previewRows: null,
      pdfTextSnippet: null,
    }
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content:
            `This is a media campaign plan document. Find the Amount Before VAT ` +
            `(the pre-tax subtotal — not the grand total). ` +
            `Return ONLY valid JSON, no extra text: ` +
            `{ "amount": number_or_null, "confidence": "high"|"medium"|"low", "reasoning": "string" }\n\n` +
            `Document text:\n${textContent.slice(0, 8000)}`,
        },
      ],
    })

    const raw = message.content[0]
    if (raw.type === 'text') {
      // Strip markdown code fences if present
      const jsonText = raw.text.replace(/```(?:json)?/g, '').trim()
      const parsed = JSON.parse(jsonText)
      return {
        amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
        confidence: (['high', 'medium', 'low'].includes(parsed.confidence)
          ? parsed.confidence
          : 'low') as DetectionConfidence,
        reasoning: String(parsed.reasoning ?? ''),
        extractionMethod: isOcr ? 'pdf_ocr' : 'pdf_text',
        previewRows: null,
        pdfTextSnippet: null,
      }
    }
  } catch (err) {
    console.error('Claude extraction error:', err)
  }

  return {
    amount: null,
    confidence: 'not_found',
    reasoning: 'AI extraction failed. Please enter the amount manually.',
    extractionMethod: isOcr ? 'pdf_ocr' : 'pdf_text',
    previewRows: null,
    pdfTextSnippet: null,
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function extractAmountFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractionResult> {
  const lower = fileName.toLowerCase()
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls')
  const isPdf = lower.endsWith('.pdf')

  if (isExcel) {
    const result = await extractFromExcel(buffer)
    // If excel direct failed, try Claude with the preview data as text
    if (result.confidence === 'not_found' && result.previewRows) {
      const textFallback = result.previewRows
        .map((r) => (r as unknown[]).join('\t'))
        .join('\n')
      const claudeResult = await extractWithClaude(textFallback, false)
      return {
        ...claudeResult,
        extractionMethod: 'excel_direct',
        previewRows: result.previewRows,
      }
    }
    return result
  }

  if (isPdf) {
    const pdfResult = await extractFromPdf(buffer)
    if (pdfResult.confidence === 'not_found') {
      // Use full PDF text (or indicate scanned) for Claude
      const textForClaude = pdfResult.pdfTextSnippet ?? '(scanned PDF — no text available)'
      const claudeResult = await extractWithClaude(textForClaude, pdfResult.extractionMethod === 'pdf_ocr')
      return {
        ...claudeResult,
        pdfTextSnippet: pdfResult.pdfTextSnippet,
      }
    }
    return pdfResult
  }

  // Unknown type — try Claude with filename hint
  return {
    amount: null,
    confidence: 'not_found',
    reasoning: 'Unsupported file type.',
    extractionMethod: 'manual',
    previewRows: null,
    pdfTextSnippet: null,
  }
}

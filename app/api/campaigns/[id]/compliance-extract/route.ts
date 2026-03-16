import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { extractAmountFromFile } from '@/lib/extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTS = ['.pdf', '.xlsx', '.xls']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'compliance' && role !== 'finance_exec') {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  const { id: campaignId } = await params

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload PDF or Excel (.xlsx, .xls).' },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 20 MB.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify campaign belongs to org
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  // Ensure bucket
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === 'campaign-documents')) {
    await supabase.storage.createBucket('campaign-documents', {
      public: false,
      fileSizeLimit: MAX_BYTES,
    })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${orgId}/${campaignId}/compliance-${timestamp}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadErr } = await supabase.storage
    .from('campaign-documents')
    .upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadErr) {
    console.error('Compliance storage upload error:', uploadErr)
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
  }

  const { data: signedData } = await supabase.storage
    .from('campaign-documents')
    .createSignedUrl(filePath, 3600)

  const fileUrl = signedData?.signedUrl ?? ''

  // Extract using compliance-specific context
  const extraction = await extractAmountFromFile(buffer, file.name, 'compliance')

  const fileType =
    ext === '.pdf'
      ? extraction.extractionMethod === 'pdf_ocr'
        ? 'pdf_scanned'
        : 'pdf_digital'
      : 'excel'

  return NextResponse.json({
    ok: true,
    filePath,
    fileUrl,
    signedUrl: fileUrl,
    fileName: file.name,
    fileSizeBytes: file.size,
    fileType,
    extractionMethod: extraction.extractionMethod,
    detectedAmount: extraction.amount,
    confidence: extraction.confidence,
    reasoning: extraction.reasoning,
    previewRows: extraction.previewRows,
    pdfTextSnippet: extraction.pdfTextSnippet,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
const ALLOWED_EXTS = ['.pdf', '.xlsx', '.xls', '.doc', '.docx', '.jpg', '.jpeg', '.png']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec' && role !== 'compliance') {
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
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED_EXTS.join(', ')}` },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 20 MB.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === 'campaign-documents')) {
    await supabase.storage.createBucket('campaign-documents', {
      public: false,
      fileSizeLimit: MAX_BYTES,
    })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${orgId}/${campaignId}/${timestamp}-${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from('campaign-documents')
    .upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadErr) {
    console.error('upload-doc storage error:', uploadErr)
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
  }

  const { data: signed } = await supabase.storage
    .from('campaign-documents')
    .createSignedUrl(filePath, 3600)

  return NextResponse.json({
    ok: true,
    filePath,
    fileUrl: signed?.signedUrl ?? '',
    fileName: file.name,
    fileSizeBytes: file.size,
  })
}

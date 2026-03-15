import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'svg', 'webp']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const orgId = session.user.orgId

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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: jpg, png, svg, webp.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 2 MB.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === 'org-assets')) {
    await supabase.storage.createBucket('org-assets', {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
  }

  const timestamp = Date.now()
  const filePath = `${orgId}/logo-${timestamp}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from('org-assets')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadErr) {
    console.error('logo-upload storage error:', uploadErr)
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
  }

  const { data: publicData } = supabase.storage.from('org-assets').getPublicUrl(filePath)
  const logoUrl = publicData.publicUrl

  // Upsert logo_url in org_settings
  const { error: dbErr } = await supabase.from('org_settings').upsert(
    { org_id: orgId, logo_url: logoUrl },
    { onConflict: 'org_id' },
  )

  if (dbErr) {
    console.error('logo-upload db error:', dbErr)
    return NextResponse.json({ error: 'Failed to save logo URL.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, logoUrl })
}

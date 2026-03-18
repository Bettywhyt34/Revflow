import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return Response.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const campaignId = formData.get('campaignId') as string | null

  if (!file || !campaignId) {
    return Response.json({ error: 'File and campaignId are required.' }, { status: 400 })
  }

  // Verify campaign belongs to org
  const supabase = createAdminClient()
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const filePath = `${orgId}/${campaignId}/mpo-${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('campaign-documents')
    .upload(filePath, new Uint8Array(arrayBuffer), {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })

  if (error) {
    console.error('MPO upload error:', error)
    return Response.json({ error: 'Upload failed.' }, { status: 500 })
  }

  return Response.json({ filePath })
}

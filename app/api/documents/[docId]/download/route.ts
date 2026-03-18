import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { docId } = await params
  const orgId = session.user.orgId
  const supabase = createAdminClient()

  // Fetch document with campaign join to verify org ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, campaign:campaign_id(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const campaign = doc.campaign as unknown as { org_id: string } | null
  if (!campaign || campaign.org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!doc.file_path) {
    return NextResponse.json({ error: 'No file attached to this document' }, { status: 404 })
  }

  const { data: signedData, error: signedErr } = await supabase.storage
    .from('campaign-documents')
    .createSignedUrl(doc.file_path, 3600)

  if (signedErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(signedData.signedUrl)
}

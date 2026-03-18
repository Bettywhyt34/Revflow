import { createAdminClient } from '@/lib/supabase/server'

export async function getOrgUsers(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role, last_login, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function getActiveInvites(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('invite_codes')
    .select('id, code, role, expires_at, created_at, created_by')
    .eq('org_id', orgId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return data ?? []
}

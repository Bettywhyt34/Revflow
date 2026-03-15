import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { path, fullName, email, password, confirmPassword, companyName, inviteCode } = body

  // ── Basic validation ──────────────────────────────────────────────────────
  if (!path || !fullName || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (path === 'create_org' && (!companyName || !confirmPassword)) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (path === 'create_org' && password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 })
  }

  if (path === 'join_org' && !inviteCode) {
    return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Check email not already registered ───────────────────────────────────
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // ── Path A: Create new organisation ──────────────────────────────────────
  if (path === 'create_org') {
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({ name: companyName, country: 'NG', default_currency: 'NGN' })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('Failed to create organisation:', orgError)
      return NextResponse.json({ error: 'Failed to create organisation.' }, { status: 500 })
    }

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        full_name: fullName,
        role: 'admin',
        org_id: org.id,
        password_hash: passwordHash,
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      console.error('Failed to create user:', userError)
      return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
    }

    // Seed timeline settings for the new org
    await supabase.from('timeline_settings').insert([
      { org_id: org.id, setting_key: 'proforma_validity_days', setting_value: { value: 30 } },
      { org_id: org.id, setting_key: 'payment_due_days', setting_value: { value: 30 } },
      { org_id: org.id, setting_key: 'chase_intervals_days', setting_value: { intervals: [7, 14, 21] } },
      { org_id: org.id, setting_key: 'overdue_escalation_days', setting_value: { value: 60 } },
    ])

    return NextResponse.json({ ok: true }, { status: 201 })
  }

  // ── Path B: Join existing organisation via invite code ────────────────────
  if (path === 'join_org') {
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, org_id, used_at, expires_at')
      .eq('code', inviteCode.trim().toUpperCase())
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 400 })
    }

    if (invite.used_at) {
      return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 })
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite code has expired.' }, { status: 400 })
    }

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        full_name: fullName,
        role: null,  // pending — admin must assign a role
        org_id: invite.org_id,
        password_hash: passwordHash,
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      console.error('Failed to create user:', userError)
      return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
    }

    // Mark invite code as used
    await supabase
      .from('invite_codes')
      .update({ used_by: newUser.id, used_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({ ok: true }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid signup path.' }, { status: 400 })
}

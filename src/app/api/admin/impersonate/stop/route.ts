import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST(_req: NextRequest) {
  const jar = await cookies()
  const refreshToken = jar.get('impersonator_refresh_token')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'Aucune session à restaurer' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user: targetUser } } = await supabase.auth.getUser()

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'Échec de restauration de session' }, { status: 500 })
  }

  if (targetUser) {
    const admin = createAdminClient()
    await admin
      .from('impersonation_log')
      .update({ ended_at: new Date().toISOString() })
      .eq('target_id', targetUser.id)
      .is('ended_at', null)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('impersonator_refresh_token')
  res.cookies.delete('impersonation_info')
  return res
}

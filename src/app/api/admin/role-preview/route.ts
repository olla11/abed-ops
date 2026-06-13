import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { VALID_ROLES } from '@/lib/role-preview'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin requis' }, { status: 403 })

  const { role } = await req.json()

  const res = NextResponse.json({ ok: true })

  if (!role || role === 'admin') {
    res.cookies.delete('role_preview')
  } else if (VALID_ROLES.includes(role)) {
    res.cookies.set('role_preview', role, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 })
  } else {
    return NextResponse.json({ error: 'role invalide' }, { status: 400 })
  }

  return res
}

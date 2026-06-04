import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'rh', 'caf'].includes(me.role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { userId, role } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: 'userId et role requis' }, { status: 400 })

  const { error } = await supabase.rpc('attribuer_role', { cible: userId, nouveau_role: role })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

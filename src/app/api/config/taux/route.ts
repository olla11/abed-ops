import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('parametres').select('valeur').eq('cle', 'taux_horaire_fcfa').single()
  return NextResponse.json({ taux: Number(data?.valeur ?? 1500) })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const { taux } = await req.json()
  if (!taux || isNaN(+taux) || +taux <= 0) {
    return NextResponse.json({ error: 'Taux invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('parametres')
    .update({ valeur: String(Math.round(+taux)), updated_at: new Date().toISOString() })
    .eq('cle', 'taux_horaire_fcfa')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, taux: Math.round(+taux) })
}

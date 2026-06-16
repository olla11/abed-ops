import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data } = await supabase
    .from('parametres')
    .select('cle, valeur')
    .in('cle', ['taux_horaire_direct_fcfa', 'taux_horaire_credit_fcfa', 'taux_horaire_fcfa'])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.cle, Number(r.valeur)]))
  const direct = map['taux_horaire_direct_fcfa'] ?? map['taux_horaire_fcfa'] ?? 1500
  const credit = map['taux_horaire_credit_fcfa'] ?? map['taux_horaire_fcfa'] ?? 1500
  return NextResponse.json({ taux: direct, taux_direct: direct, taux_credit: credit })
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

  const body = await req.json()
  const updates: Array<{ cle: string; valeur: string }> = []

  if (body.taux_direct !== undefined) {
    const v = Math.round(+body.taux_direct)
    if (!v || v <= 0) return NextResponse.json({ error: 'Taux direct invalide' }, { status: 400 })
    updates.push({ cle: 'taux_horaire_direct_fcfa', valeur: String(v) })
  }
  if (body.taux_credit !== undefined) {
    const v = Math.round(+body.taux_credit)
    if (!v || v <= 0) return NextResponse.json({ error: 'Taux crédit invalide' }, { status: 400 })
    updates.push({ cle: 'taux_horaire_credit_fcfa', valeur: String(v) })
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Aucun taux fourni' }, { status: 400 })

  for (const u of updates) {
    const { error } = await supabase
      .from('parametres')
      .upsert({ cle: u.cle, valeur: u.valeur }, { onConflict: 'cle' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
